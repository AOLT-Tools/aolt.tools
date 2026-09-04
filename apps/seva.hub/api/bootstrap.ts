import {
  firstQueryValue,
  type ApiRequest,
  type ApiResponse
} from '@aolt/core/api';
import { methodNotAllowed, sendApiError } from '../server/errors.js';

async function loadSessionUser(req: ApiRequest) {
  const { readSessionUser } = await import('../server/auth/session.js');
  return readSessionUser(req);
}

async function loadDataStore() {
  const { getApiDataStore } = await import('../server/storage/dataStore.js');
  return getApiDataStore();
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const startedAt = Date.now();
  const context = {
    route: 'GET /api/bootstrap',
    action: 'load_bootstrap',
    startedAt,
    messages: {
      timeout: 'Unable to load data right now. Please try again.',
      upstream: 'Unable to load data right now. Please try again.',
      upstreamPermission:
        'Unable to access data right now. Please contact an admin if this continues.',
      internal: 'Unable to load application data.'
    }
  };

  if (req.method !== 'GET') {
    return methodNotAllowed(res, context, 'GET');
  }

  try {
    const user = await loadSessionUser(req);
    if (!user) {
      return sendApiError(res, new Error('Authentication required.'), context, {
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'Authentication required.',
        retryable: false,
        category: 'unauthenticated'
      });
    }

    const campaignId = firstQueryValue(req, 'campaignId') || undefined;
    const store = await loadDataStore();
    const result = await store.getBootstrapForAuthorizedUser(user, campaignId);
    if (!result.allowed) {
      return sendApiError(res, new Error('Authorization denied.'), context, {
        status: 403,
        code: 'FORBIDDEN',
        message: 'Your account is not authorized to access this application.',
        retryable: false,
        category: 'authorization_denied'
      });
    }

    return res.status(200).json(result.value);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('CAMPAIGN_NOT_FOUND')) {
      return sendApiError(res, error, context, {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Campaign not found.',
        retryable: false,
        category: 'not_found'
      });
    }
    return sendApiError(res, error, context);
  }
}
