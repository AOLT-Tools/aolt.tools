import type { ApiErrorCode } from '../../shared/contracts/appContracts';
import {
  BrowserApiClient,
  BrowserApiClientError,
  isBrowserApiClientError,
  toUserErrorMessage as toBrowserUserErrorMessage,
  type BrowserApiClientErrorCode
} from '@aolt/core/browser-api-client';

export type ApiClientErrorCode = BrowserApiClientErrorCode<ApiErrorCode>;

export class ApiClientError extends BrowserApiClientError<ApiErrorCode> {
  constructor(
    message: string,
    status: number,
    code?: ApiClientErrorCode,
    retryable = false,
    traceId?: string
  ) {
    super(message, status, code, retryable, traceId);
  }
}

export class ApiClient extends BrowserApiClient<ApiErrorCode> {
  constructor(baseUrl: string, timeoutMs = 15_000) {
    super({
      baseUrl,
      timeoutMs,
      errorClass: ApiClientError
    });
  }
}

export function isApiClientError(value: unknown): value is ApiClientError {
  return value instanceof ApiClientError || isBrowserApiClientError(value);
}

export function toUserErrorMessage(error: unknown, fallback: string): string {
  return toBrowserUserErrorMessage(error, fallback);
}
