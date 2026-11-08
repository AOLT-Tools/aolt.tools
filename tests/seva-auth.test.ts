import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '@aolt/core/api';
import { SheetsRequestError } from '../apps/seva.hub/server/sheets/client.js';

const { mockGetUserFromAuthCode, mockSetSessionCookie, mockStore } = vi.hoisted(() => ({
  mockGetUserFromAuthCode: vi.fn(),
  mockSetSessionCookie: vi.fn(),
  mockStore: { isUserAllowed: vi.fn() }
}));

vi.mock('../apps/seva.hub/server/auth/oauth.js', () => ({
  buildGoogleAuthUrl: vi.fn(),
  createOAuthState: vi.fn(),
  getUserFromAuthCode: mockGetUserFromAuthCode
}));

vi.mock('../apps/seva.hub/server/auth/session.js', () => ({
  clearSessionCookie: vi.fn(),
  readSessionUser: vi.fn(),
  setSessionCookie: mockSetSessionCookie
}));

vi.mock('../apps/seva.hub/server/storage/dataStore.js', () => ({
  getApiDataStore: () => mockStore
}));

import handler from '../apps/seva.hub/api/auth.js';

function createResponse() {
  const state: { statusCode: number; body: unknown } = {
    statusCode: 0,
    body: undefined
  };
  const headers = new Map<string, number | string | string[]>();
  const response: ApiResponse = {
    status(code) {
      state.statusCode = code;
      return response;
    },
    json(body) {
      state.body = body;
      return response;
    },
    setHeader(name, value) {
      headers.set(name, value);
    },
    getHeader(name) {
      return headers.get(name);
    },
    end() {}
  };
  return { response, state, headers };
}

const request: ApiRequest = {
  method: 'GET',
  headers: { cookie: 'seva_hub_oauth_state=expected-state' },
  query: { action: 'callback', code: 'auth-code', state: 'expected-state' }
};

describe('Google OAuth callback error distinction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGetUserFromAuthCode.mockResolvedValue({
      id: 'user-1',
      email: 'volunteer@example.com'
    });
  });

  it('redirects a completed authorization denial as forbidden', async () => {
    mockStore.isUserAllowed.mockResolvedValue(false);
    const { response, state, headers } = createResponse();

    await handler(request, response);

    expect(state.statusCode).toBe(302);
    expect(headers.get('Location')).toBe('/seva?error=forbidden');
  });

  it('redirects a Sheets timeout as an upstream timeout, not forbidden', async () => {
    mockStore.isUserAllowed.mockRejectedValue(
      new SheetsRequestError(
        'Google Sheets authenticated request timed out.',
        'timeout',
        'access',
        'values.get',
        10_000,
        true,
        undefined,
        undefined,
        'authenticated_request'
      )
    );
    const { response, state, headers } = createResponse();

    await handler(request, response);

    expect(state.statusCode).toBe(302);
    expect(headers.get('Location')).toBe('/seva?error=upstream_timeout');
  });

  it.each([
    ['%2Fseva%2Fadd-lead', '/seva/add-lead'],
    ['https%3A%2F%2Fevil.example', '/seva']
  ])(
    'returns only to an allowed deep-link destination (%s)',
    async (cookie, expected) => {
      mockStore.isUserAllowed.mockResolvedValue(true);
      const { response, headers } = createResponse();
      await handler(
        {
          ...request,
          headers: {
            cookie:
              'seva_hub_oauth_state=expected-state; seva_hub_oauth_return_to=' + cookie
          }
        },
        response
      );
      expect(headers.get('Location')).toBe(expected);
      expect(headers.get('Set-Cookie')).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/seva_hub_oauth_return_to=;.*Max-Age=0/)
        ])
      );
    }
  );

  it('redirects a successful sign-in to the volunteer workspace', async () => {
    mockStore.isUserAllowed.mockResolvedValue(true);
    const { response, state, headers } = createResponse();

    await handler(request, response);

    expect(state.statusCode).toBe(302);
    expect(headers.get('Location')).toBe('/seva');
    expect(mockSetSessionCookie).toHaveBeenCalledOnce();
  });
});
