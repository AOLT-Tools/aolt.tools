import { beforeEach, describe, expect, it } from 'vitest';
import type { VercelRequest } from '@vercel/node';
import { z } from 'zod';
import { __resetEnvForTests } from '@aolt/core/env';
import {
  assertMutationRequest,
  createJwtSessionManager,
  createSessionToken,
  readSession
} from '@aolt/integrations/auth/session';

beforeEach(() => {
  process.env.SESSION_SECRETS = 'test-session-secret-with-more-than-32-characters';
  process.env.APP_BASE_URL = 'https://example.test';
  __resetEnvForTests();
});

describe('signed sessions', () => {
  it('round-trips a signed actor without exposing a server-side session store', async () => {
    const token = await createSessionToken(
      {
        id: 'google-subject',
        email: 'developer@example.com',
        name: 'Developer'
      },
      'csrf-token-with-enough-entropy'
    );
    const actor = await readSession({
      headers: { cookie: 'app_session=' + encodeURIComponent(token) }
    } as VercelRequest);
    expect(actor).toMatchObject({
      id: 'google-subject',
      email: 'developer@example.com',
      csrfToken: 'csrf-token-with-enough-entropy'
    });
  });

  it('requires both an allowed origin and matching CSRF value', () => {
    const actor = {
      id: 'id',
      email: 'developer@example.com',
      name: 'Developer',
      csrfToken: 'expected-csrf'
    };
    expect(() =>
      assertMutationRequest(
        {
          headers: {
            origin: 'https://example.test',
            'x-csrf-token': 'expected-csrf'
          }
        } as unknown as VercelRequest,
        actor
      )
    ).not.toThrow();
    expect(() =>
      assertMutationRequest(
        {
          headers: {
            origin: 'https://attacker.test',
            'x-csrf-token': 'expected-csrf'
          }
        } as unknown as VercelRequest,
        actor
      )
    ).toThrow('origin');
  });

  it('supports app-configured JWT session managers', async () => {
    const manager = createJwtSessionManager({
      userSchema: z.object({
        id: z.string().min(1),
        email: z.email(),
        name: z.string().optional(),
        picture: z.string().optional()
      }),
      getSecrets: () => 'app-session-secret-with-more-than-32-characters',
      getCookieName: () => 'custom_session',
      getTtlSeconds: () => 60
    });
    const token = await manager.createSessionToken({
      id: 'subject',
      email: 'developer@example.com'
    });

    await expect(
      manager.readSessionFromCookieHeader('custom_session=' + encodeURIComponent(token))
    ).resolves.toEqual({
      id: 'subject',
      email: 'developer@example.com'
    });
  });
});
