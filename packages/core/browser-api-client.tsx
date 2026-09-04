export type ApiClientTransportErrorCode =
  'NETWORK_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE';

export type BrowserApiClientErrorCode<TBackendCode extends string = string> =
  TBackendCode | ApiClientTransportErrorCode;

export type BrowserApiClientErrorMessages = {
  timeout: string;
  network: string;
  invalidResponse: string;
  requestFailed: string;
  forbidden: string;
  unauthenticated: string;
};

export class BrowserApiClientError<TBackendCode extends string = string> extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: BrowserApiClientErrorCode<TBackendCode>,
    public readonly retryable = false,
    public readonly traceId?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export type BrowserApiClientErrorConstructor<TBackendCode extends string> = new (
  message: string,
  status: number,
  code?: BrowserApiClientErrorCode<TBackendCode>,
  retryable?: boolean,
  traceId?: string
) => BrowserApiClientError<TBackendCode>;

export type BrowserApiClientOptions<TBackendCode extends string = string> = {
  baseUrl?: string;
  timeoutMs?: number;
  credentials?: RequestCredentials;
  defaultHeaders?: () => HeadersInit | undefined;
  fetcher?: typeof fetch;
  errorClass?: BrowserApiClientErrorConstructor<TBackendCode>;
  errorMessages?: Partial<BrowserApiClientErrorMessages>;
};

const DEFAULT_ERROR_MESSAGES: BrowserApiClientErrorMessages = {
  timeout: 'The request is taking too long. Please try again.',
  network:
    'Unable to reach the server right now. Please check your connection and try again.',
  invalidResponse: 'The server returned an unexpected response. Please try again.',
  requestFailed: 'Unable to complete the request. Please try again.',
  forbidden: 'You do not have permission to perform this action.',
  unauthenticated: 'Your session has expired. Please sign in again.'
};

function responseErrorData(json: unknown): Record<string, unknown> | null {
  if (typeof json !== 'object' || json === null) {
    return null;
  }
  const error = (json as Record<string, unknown>).error;
  return typeof error === 'object' && error !== null
    ? (error as Record<string, unknown>)
    : null;
}

function mergeHeaders(
  defaultHeaders: HeadersInit | undefined,
  initHeaders: HeadersInit | undefined
): Headers {
  const headers = new Headers(defaultHeaders);
  new Headers(initHeaders).forEach((value, key) => headers.set(key, value));
  return headers;
}

function jsonRequestInit(
  method: string,
  body: unknown,
  init: RequestInit
): RequestInit {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return {
    ...init,
    method,
    headers,
    body: JSON.stringify(body)
  };
}

export class BrowserApiClient<TBackendCode extends string = string> {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly credentials: RequestCredentials;
  private readonly fetcher: typeof fetch;
  private readonly ErrorClass: BrowserApiClientErrorConstructor<TBackendCode>;
  private readonly messages: BrowserApiClientErrorMessages;
  private readonly defaultHeaders?: () => HeadersInit | undefined;

  constructor(options: BrowserApiClientOptions<TBackendCode> = {}) {
    this.baseUrl = options.baseUrl || '';
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.credentials = options.credentials || 'include';
    this.fetcher = options.fetcher || globalThis.fetch.bind(globalThis);
    this.ErrorClass =
      options.errorClass ||
      (BrowserApiClientError as BrowserApiClientErrorConstructor<TBackendCode>);
    this.messages = {
      ...DEFAULT_ERROR_MESSAGES,
      ...options.errorMessages
    };
    this.defaultHeaders = options.defaultHeaders;
  }

  async get<T>(path: string, init: RequestInit = {}): Promise<T> {
    return this.request<T>(path, { ...init, method: 'GET' });
  }

  async put<T>(path: string, body: unknown, init: RequestInit = {}): Promise<T> {
    return this.request<T>(path, jsonRequestInit('PUT', body, init));
  }

  async post<T>(path: string, body: unknown, init: RequestInit = {}): Promise<T> {
    return this.request<T>(path, jsonRequestInit('POST', body, init));
  }

  async delete<T>(path: string, body: unknown, init: RequestInit = {}): Promise<T> {
    return this.request<T>(path, jsonRequestInit('DELETE', body, init));
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetcher(this.baseUrl + path, {
        ...init,
        credentials: init.credentials || this.credentials,
        signal: controller.signal,
        headers: mergeHeaders(this.defaultHeaders?.(), init.headers)
      });
      return this.parseJson<T>(response);
    } catch (error) {
      if (isBrowserApiClientError(error)) {
        throw error;
      }
      if (controller.signal.aborted) {
        throw this.createError(this.messages.timeout, 0, 'TIMEOUT', true);
      }
      throw this.createError(this.messages.network, 0, 'NETWORK_ERROR', true);
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }

  private async parseJson<T>(response: Response): Promise<T> {
    let json: unknown;
    try {
      json = (await response.json()) as unknown;
    } catch {
      if (response.ok) {
        throw this.createError(
          this.messages.invalidResponse,
          response.status,
          'INVALID_RESPONSE',
          true
        );
      }
      json = {};
    }

    if (!response.ok) {
      const errorData = responseErrorData(json);
      throw this.createError(
        typeof errorData?.message === 'string'
          ? errorData.message
          : this.messages.requestFailed,
        response.status,
        typeof errorData?.code === 'string'
          ? (errorData.code as BrowserApiClientErrorCode<TBackendCode>)
          : undefined,
        typeof errorData?.retryable === 'boolean' ? errorData.retryable : false,
        typeof errorData?.traceId === 'string' ? errorData.traceId : undefined
      );
    }

    return json as T;
  }

  private createError(
    message: string,
    status: number,
    code?: BrowserApiClientErrorCode<TBackendCode>,
    retryable = false,
    traceId?: string
  ): BrowserApiClientError<TBackendCode> {
    return new this.ErrorClass(message, status, code, retryable, traceId);
  }
}

export function isBrowserApiClientError(
  value: unknown
): value is BrowserApiClientError {
  return value instanceof BrowserApiClientError;
}

export function toUserErrorMessage(
  error: unknown,
  fallback: string,
  messages: Partial<
    Pick<BrowserApiClientErrorMessages, 'forbidden' | 'unauthenticated'>
  > = {}
): string {
  if (!isBrowserApiClientError(error)) {
    return fallback;
  }
  if (error.code === 'FORBIDDEN') {
    return messages.forbidden || DEFAULT_ERROR_MESSAGES.forbidden;
  }
  if (error.code === 'UNAUTHENTICATED') {
    return messages.unauthenticated || DEFAULT_ERROR_MESSAGES.unauthenticated;
  }
  return error.message || fallback;
}
