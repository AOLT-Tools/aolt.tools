import { randomUUID } from 'node:crypto';
import type { ApiResponse } from './api.js';

const MAX_LOG_MESSAGE_CHARS = 500;

export type ApiErrorMessages = {
  validation?: string;
  timeout?: string;
  upstream?: string;
  upstreamPermission?: string;
  internal?: string;
};

export type ApiErrorContext = {
  route: string;
  action: string;
  startedAt?: number;
  messages?: ApiErrorMessages;
};

export type ApiErrorOverride<TCode extends string = string> = {
  status: number;
  code: TCode;
  message: string;
  retryable: boolean;
  category?: string;
};

export type ReportedApiError<TCode extends string = string> = {
  traceId: string;
  status: number;
  code: TCode;
  message: string;
  retryable: boolean;
};

export type ApiErrorClassifier<TCode extends string> = (
  error: unknown,
  context: ApiErrorContext,
  override?: ApiErrorOverride<TCode>
) => ApiErrorOverride<TCode>;

export type ApiErrorReporterOptions<TCode extends string> = {
  classify: ApiErrorClassifier<TCode>;
  logDetails?: (error: unknown) => Record<string, unknown>;
  logLabel?: string;
  logger?: Pick<Console, 'error'>;
};

export function redactApiLogMessage(value: string): string {
  return value
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi,
      '[REDACTED PRIVATE KEY]'
    )
    .replace(
      /(access[_-]?token|refresh[_-]?token|authorization|client[_-]?secret|session[_-]?secret)\s*[:=]\s*[^\s,;]+/gi,
      '$1=[REDACTED]'
    )
    .slice(0, MAX_LOG_MESSAGE_CHARS);
}

function getErrorType(error: unknown): string {
  if (error instanceof Error) {
    return error.name || error.constructor.name || 'Error';
  }
  return typeof error;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return redactApiLogMessage(error.message);
  }
  return redactApiLogMessage(String(error));
}

export function createApiErrorReporter<TCode extends string>(
  options: ApiErrorReporterOptions<TCode>
) {
  const logger = options.logger || console;
  const logLabel = options.logLabel || '[api-error]';

  function reportApiError(
    error: unknown,
    context: ApiErrorContext,
    override?: ApiErrorOverride<TCode>
  ): ReportedApiError<TCode> {
    const classified = options.classify(error, context, override);
    const traceId = randomUUID();
    const durationMs = Math.max(0, Date.now() - (context.startedAt || Date.now()));

    logger.error(logLabel, {
      traceId,
      route: context.route,
      action: context.action,
      durationMs,
      category: classified.category,
      errorType: getErrorType(error),
      errorMessage: getErrorMessage(error),
      ...(options.logDetails?.(error) || {})
    });

    return {
      traceId,
      status: classified.status,
      code: classified.code,
      message: classified.message,
      retryable: classified.retryable
    };
  }

  function sendApiError(
    res: ApiResponse,
    error: unknown,
    context: ApiErrorContext,
    override?: ApiErrorOverride<TCode>
  ) {
    const reported = reportApiError(error, context, override);
    return res.status(reported.status).json({
      success: false,
      error: {
        code: reported.code,
        message: reported.message,
        retryable: reported.retryable,
        traceId: reported.traceId
      }
    });
  }

  return { reportApiError, sendApiError };
}
