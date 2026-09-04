import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import type { VercelResponse } from '@vercel/node';
import type { ApiErrorCode } from '@aolt/shared/contracts';

export class AppError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number,
    public readonly retryable = false,
    public readonly category = code.toLowerCase(),
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'AppError';
  }
}

const secretPattern =
  /(bearer\s+|token[=:]\s*|secret[=:]\s*|private[_ -]?key[=:]\s*)[^\s,;]+/gi;

export function redact(value: unknown): string {
  return String(value instanceof Error ? value.message : value)
    .replace(secretPattern, '$1[REDACTED]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[REDACTED_EMAIL]')
    .slice(0, 500);
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) {
    return new AppError(
      'VALIDATION_ERROR',
      'Some provided details are invalid.',
      400,
      false,
      'validation',
      { cause: error }
    );
  }
  return new AppError(
    'INTERNAL_ERROR',
    'Unable to complete this action.',
    500,
    false,
    'internal',
    { cause: error }
  );
}

export function sendError(
  res: VercelResponse,
  error: unknown,
  context: { route: string; action: string; startedAt?: number }
) {
  const normalized = normalizeError(error);
  const traceId = randomUUID();
  console.error('[api-error]', {
    traceId,
    route: context.route,
    action: context.action,
    durationMs: Date.now() - (context.startedAt || Date.now()),
    category: normalized.category,
    error: redact(error)
  });
  return res.status(normalized.status).json({
    success: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      retryable: normalized.retryable,
      traceId
    }
  });
}
