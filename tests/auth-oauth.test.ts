import { afterEach, describe, expect, it } from 'vitest';
import { resolveGoogleRedirectUri } from '@aolt/integrations/auth/oauth';

const originalVercelUrl = process.env.VERCEL_URL;

afterEach(() => {
  process.env.VERCEL_URL = originalVercelUrl;
});

describe('google oauth helpers', () => {
  it('prefers explicit redirect URIs and falls back to Vercel URL', () => {
    expect(resolveGoogleRedirectUri('https://app.test/auth/callback')).toBe(
      'https://app.test/auth/callback'
    );

    process.env.VERCEL_URL = 'preview.example.test';
    expect(resolveGoogleRedirectUri(undefined, '/api/auth/callback')).toBe(
      'https://preview.example.test/api/auth/callback'
    );
  });
});
