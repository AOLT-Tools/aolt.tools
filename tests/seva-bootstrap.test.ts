import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '@aolt/core/api';
import { SheetsRequestError } from '../apps/seva.hub/server/sheets/client.js';

const { mockReadSessionUser, mockStore } = vi.hoisted(() => ({
  mockReadSessionUser: vi.fn(),
  mockStore: { getBootstrapForAuthorizedUser: vi.fn() }
}));

vi.mock('../apps/seva.hub/server/auth/session.js', () => ({
  readSessionUser: mockReadSessionUser
}));

vi.mock('../apps/seva.hub/server/storage/dataStore.js', () => ({
  getApiDataStore: () => mockStore
}));

import handler from '../apps/seva.hub/api/bootstrap.js';

function createResponse() {
  const state: { statusCode: number; body: unknown } = {
    statusCode: 0,
    body: undefined
  };
  const response: ApiResponse = {
    status(code) {
      state.statusCode = code;
      return response;
    },
    json(body) {
      state.body = body;
      return response;
    },
    setHeader() {},
    getHeader() {
      return undefined;
    },
    end() {}
  };
  return { response, state };
}

const request: ApiRequest = { method: 'GET', headers: {}, query: {} };

describe('bootstrap error propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockReadSessionUser.mockResolvedValue({
      id: 'user-1',
      email: 'volunteer@example.com'
    });
  });

  it('requests metadata without lead rows for the direct entry flow', async () => {
    mockStore.getBootstrapForAuthorizedUser.mockResolvedValue({
      allowed: true,
      value: { success: true, leads: [] }
    });
    const { response, state } = createResponse();
    await handler(
      { ...request, query: { campaignId: 'all', metadataOnly: '1' } },
      response
    );
    expect(state.statusCode).toBe(200);
    expect(mockStore.getBootstrapForAuthorizedUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'volunteer@example.com' }),
      'all',
      undefined,
      true
    );
  });

  it('requires authentication even for metadata-only bootstrap', async () => {
    mockReadSessionUser.mockResolvedValue(null);
    const { response, state } = createResponse();
    await handler({ ...request, query: { metadataOnly: '1' } }, response);
    expect(state.statusCode).toBe(401);
    expect(mockStore.getBootstrapForAuthorizedUser).not.toHaveBeenCalled();
  });

  it('keeps a completed allowlist denial separate from infrastructure failure', async () => {
    mockStore.getBootstrapForAuthorizedUser.mockResolvedValue({
      allowed: false
    });
    const { response, state } = createResponse();

    await handler(request, response);

    expect(state).toMatchObject({
      statusCode: 403,
      body: {
        success: false,
        error: {
          code: 'FORBIDDEN',
          retryable: false,
          traceId: expect.any(String)
        }
      }
    });
  });

  it('returns a retryable 504 for a Sheets authorization timeout', async () => {
    mockStore.getBootstrapForAuthorizedUser.mockRejectedValue(
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
    const { response, state } = createResponse();

    await handler(request, response);

    expect(state).toMatchObject({
      statusCode: 504,
      body: {
        success: false,
        error: {
          code: 'UPSTREAM_TIMEOUT',
          message: 'Unable to load data right now. Please try again.',
          retryable: true,
          traceId: expect.any(String)
        }
      }
    });
    expect(console.error).toHaveBeenCalledWith(
      '[api-error]',
      expect.objectContaining({
        upstream: 'google_sheets',
        target: 'access',
        timeoutStage: 'authenticated_request'
      })
    );
  });
});
