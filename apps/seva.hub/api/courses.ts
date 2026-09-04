import {
  firstQueryValue,
  headerValue,
  type ApiRequest,
  type ApiResponse
} from '@aolt/core/api';
import { methodNotAllowed, sendApiError } from '../server/errors.js';

async function loadDataStore() {
  const { getApiDataStore } = await import('../server/storage/dataStore.js');
  return getApiDataStore();
}

async function loadSessionUser(req: ApiRequest) {
  const { readSessionUser } = await import('../server/auth/session.js');
  return readSessionUser(req);
}

function hasQueryValue(req: ApiRequest, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(req.query, name);
}

function normalizeShortUrlSlug(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/')
    .toLowerCase();
}

function getRequestOrigin(req: ApiRequest): string {
  const forwardedHost = headerValue(req.headers, 'x-forwarded-host')
    .split(',')[0]
    .trim();
  const host = (
    forwardedHost ||
    headerValue(req.headers, 'host').split(',')[0].trim() ||
    'seva.hub'
  ).replace(/\/$/, '');
  const proto =
    headerValue(req.headers, 'x-forwarded-proto').split(',')[0].trim() || 'https';
  return proto + '://' + host;
}

async function servePublicCoursesPage(req: ApiRequest, res: ApiResponse) {
  const context = {
    route: 'GET /api/seva/courses?public=1',
    action: 'serve_public_courses_page',
    startedAt: Date.now(),
    messages: { internal: 'Unable to load courses.' }
  };
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    return methodNotAllowed(res, context, 'GET, HEAD');
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60');
  const origin = getRequestOrigin(req);
  const requestedProgram = firstQueryValue(req, 'program').trim().toLowerCase();

  try {
    const [store, publicHtml] = await Promise.all([
      loadDataStore(),
      import('../server/courses/publicHtml.js')
    ]);
    const page = await store.getPublicCourses(requestedProgram);
    const { renderPublicCourseHtml, toPublicCourseView } = publicHtml;
    const courses = page.courses.map(toPublicCourseView);
    const selected = page.selected
      ? toPublicCourseView(page.selected)
      : courses[0] || null;
    const rendered = renderPublicCourseHtml({
      selected,
      courses,
      origin,
      programKey: page.selectionMatched ? requestedProgram : ''
    });
    return res.status(rendered.status).end(rendered.html);
  } catch {
    const { renderPublicCourseHtml } = await import('../server/courses/publicHtml.js');
    const missing = renderPublicCourseHtml({
      selected: null,
      origin
    });
    return res.status(missing.status).end(missing.html);
  }
}

async function serveShortUrlRedirect(req: ApiRequest, res: ApiResponse) {
  const context = {
    route: 'GET /go/:slug*',
    action: 'resolve_short_url',
    startedAt: Date.now(),
    messages: { internal: 'Unable to resolve that short link.' }
  };
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    return methodNotAllowed(res, context, 'GET, HEAD');
  }

  const slug = normalizeShortUrlSlug(firstQueryValue(req, 'go'));
  if (!slug) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).end('Short link not found.');
  }

  try {
    const store = await loadDataStore();
    const destination = await store.getShortUrlDestination(slug);
    if (!destination) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).end('Short link not found.');
    }

    res.setHeader('Location', destination);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(302).end();
  } catch (error) {
    return sendApiError(res, error, context);
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const id = firstQueryValue(req, 'id');
  const catalog = firstQueryValue(req, 'catalog');
  if (hasQueryValue(req, 'go')) {
    return serveShortUrlRedirect(req, res);
  }

  const isPublicPage = firstQueryValue(req, 'public') === '1';
  if (isPublicPage) {
    return servePublicCoursesPage(req, res);
  }

  const isCatalog = req.method === 'GET' && catalog === '1';
  const isMutate = req.method === 'PUT' || req.method === 'DELETE';
  const isCreate = req.method === 'POST';
  const context = {
    route: String(req.method || 'UNKNOWN') + ' /api/seva/courses',
    action: isMutate
      ? req.method === 'DELETE'
        ? 'delete_course'
        : 'update_course'
      : isCreate
        ? 'create_course'
        : isCatalog
          ? 'list_public_homepage_offers'
          : 'list_courses',
    startedAt: Date.now(),
    messages: {
      validation: 'Invalid activity details.',
      timeout: isMutate
        ? 'Unable to save the activity right now. Please try again.'
        : 'Unable to load activities right now. Please try again.',
      upstream: isMutate
        ? 'Unable to save the activity right now. Please try again.'
        : 'Unable to load activities right now. Please try again.',
      upstreamPermission: isMutate
        ? 'Unable to save the activity. Please contact an admin if this continues.'
        : 'Unable to access activities. Please contact an admin if this continues.',
      internal: isMutate ? 'Unable to save the activity.' : 'Unable to load activities.'
    }
  };

  if (isMutate) {
    if (!id) {
      return methodNotAllowed(res, context, 'GET, POST, PUT, DELETE');
    }
  } else if (req.method !== 'GET' && req.method !== 'POST') {
    return methodNotAllowed(res, context, 'GET, POST, PUT, DELETE');
  }

  try {
    if (isCatalog) {
      const store = await loadDataStore();
      const offers = await store.listPublicHomepageOffers();
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.status(200).json(offers);
    }

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

    const store = await loadDataStore();
    if (isMutate) {
      const requestBody =
        typeof req.body === 'object' && req.body && !Array.isArray(req.body)
          ? req.body
          : {};
      const payload = {
        ...requestBody,
        id
      };
      const result =
        req.method === 'DELETE'
          ? await store.deleteCourseForAuthorizedUser(user, payload)
          : await store.updateCourseForAuthorizedUser(user, payload);
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
    }

    const result = isCreate
      ? await store.createCourseForAuthorizedUser(user, req.body)
      : await store.listCoursesForAuthorizedUser(user);
    if (!result.allowed) {
      return sendApiError(res, new Error('Authorization denied.'), context, {
        status: 403,
        code: 'FORBIDDEN',
        message: 'Your account is not authorized to access this application.',
        retryable: false,
        category: 'authorization_denied'
      });
    }
    return res.status(isCreate ? 201 : 200).json(result.value);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (isMutate && message.includes('Course not found.')) {
      return sendApiError(res, error, context, {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Activity not found.',
        retryable: false,
        category: 'not_found'
      });
    }
    return sendApiError(res, error, context);
  }
}
