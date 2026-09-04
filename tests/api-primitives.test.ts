import { describe, expect, it } from 'vitest';
import {
  bodyAsBuffer,
  firstQueryValue,
  headerValue,
  readRawBody,
  type ApiRequest
} from '@aolt/core/api';
import { createApiErrorReporter, redactApiLogMessage } from '@aolt/core/api-errors';
import {
  normalizeEmail,
  normalizeIndianMobile,
  normalizePincode,
  normalizeSpaces
} from '@aolt/core/normalization';

function responseRecorder() {
  let statusCode = 200;
  let body: unknown;
  const headers = new Map<string, number | string | string[]>();
  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(value: unknown) {
      body = value;
      return response;
    },
    setHeader(name: string, value: string | string[]) {
      headers.set(name, value);
    },
    getHeader(name: string) {
      return headers.get(name);
    },
    end() {
      return undefined;
    }
  };
  return { response, read: () => ({ statusCode, body, headers }) };
}

describe('api primitives', () => {
  it('reads query and header values from serverless request shapes', () => {
    const req: ApiRequest = {
      headers: { 'x-test': ['first', 'second'] },
      query: { id: ['abc', 'def'] }
    };
    expect(firstQueryValue(req, 'id')).toBe('abc');
    expect(headerValue(req.headers, 'X-Test')).toBe('first');
  });

  it('materializes raw request bodies with a byte limit', async () => {
    const req: ApiRequest = {
      headers: {},
      query: {},
      body: { ok: true }
    };
    expect(await readRawBody(req, 20)).toEqual(bodyAsBuffer({ ok: true }));
    await expect(readRawBody(req, 5)).rejects.toThrow('REQUEST_BODY_TOO_LARGE');
  });
});

describe('normalization helpers', () => {
  it('normalizes common contact fields', () => {
    expect(normalizeEmail('  USER@Example.COM ')).toBe('user@example.com');
    expect(normalizeSpaces('  Art   of   Living  ')).toBe('Art of Living');
    expect(normalizeIndianMobile('+91 98765 43210')).toBe('9876543210');
    expect(normalizeIndianMobile('12345')).toBe('');
    expect(normalizePincode('HP 560045')).toBe('560045');
  });
});

describe('api error reporter', () => {
  it('redacts sensitive values and writes the standard error response', () => {
    expect(redactApiLogMessage('Bearer token client_secret=secret')).toContain(
      '[REDACTED]'
    );

    const calls: unknown[][] = [];
    const reporter = createApiErrorReporter<'INTERNAL_ERROR'>({
      logger: { error: (...args: unknown[]) => calls.push(args) },
      classify: () => ({
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Unable to complete this action.',
        retryable: false,
        category: 'internal'
      })
    });
    const recorded = responseRecorder();
    reporter.sendApiError(recorded.response, new Error('Bearer secret'), {
      route: 'GET /api/test',
      action: 'test'
    });
    const output = recorded.read();
    expect(output.statusCode).toBe(500);
    expect(output.body).toMatchObject({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unable to complete this action.',
        retryable: false
      }
    });
    expect(calls).toHaveLength(1);
  });
});
