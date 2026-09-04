import { JWT } from 'google-auth-library';

export type SheetsValuesResponse = {
  values?: string[][];
};

export type SheetsBatchValuesResponse = {
  valueRanges?: Array<{
    values?: string[][];
  }>;
};

export type SheetsSpreadsheetResponse = {
  sheets?: Array<{
    properties?: {
      sheetId?: number;
      title?: string;
    };
  }>;
};

export type SheetsBatchUpdate = {
  range: string;
  values: string[][];
};

export type SheetsRequestAction =
  | 'values.get'
  | 'values.batchGet'
  | 'values.batchUpdate'
  | 'values.append'
  | 'spreadsheets.get'
  | 'spreadsheets.batchUpdate';

export type SheetsFailureKind =
  'timeout' | 'authentication' | 'permission' | 'network' | 'upstream';

export class SheetsRequestError extends Error {
  constructor(
    message: string,
    public readonly kind: SheetsFailureKind,
    public readonly target: string,
    public readonly action: SheetsRequestAction,
    public readonly durationMs: number,
    public readonly retryable: boolean,
    public readonly upstreamStatus?: number,
    public readonly safeUpstreamError?: string,
    public readonly timeoutStage?: 'authenticated_request',
    cause?: unknown
  ) {
    super(message, { cause });
    this.name = 'SheetsRequestError';
  }
}

export type SheetsOperation = {
  signal: AbortSignal;
  timeoutMs: number;
  dispose: () => void;
};

export type GoogleSheetsApiCredentials<TTarget extends string> = {
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
  spreadsheetIds: Record<TTarget, string>;
};

export type GoogleSheetsApiOptions<TTarget extends string> = {
  getCredentials: () => GoogleSheetsApiCredentials<TTarget>;
  timeoutMs?: number;
  scopes?: readonly string[];
};

const DEFAULT_SHEETS_OPERATION_TIMEOUT_MS = 10_000;

function querySuffix(query: string): string {
  return query ? '?' + query : '';
}

export function buildGoogleSheetsValuesUrl(
  spreadsheetId: string,
  range: string,
  query = ''
): string {
  return (
    'https://sheets.googleapis.com/v4/spreadsheets/' +
    spreadsheetId +
    '/values/' +
    encodeURIComponent(range) +
    querySuffix(query)
  );
}

export function buildGoogleSheetsAppendUrl(
  spreadsheetId: string,
  range: string,
  query = ''
): string {
  return (
    buildGoogleSheetsValuesUrl(spreadsheetId, range) + ':append' + querySuffix(query)
  );
}

export function createSheetsOperation(
  timeoutMs = DEFAULT_SHEETS_OPERATION_TIMEOUT_MS
): SheetsOperation {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(
      new Error(
        'Google Sheets API operation timed out after ' + String(timeoutMs) + 'ms.'
      )
    );
  }, timeoutMs);

  return {
    signal: controller.signal,
    timeoutMs,
    dispose() {
      clearTimeout(timeout);
    }
  };
}

export function waitForSheetsOperation<T>(
  promise: Promise<T>,
  signal: AbortSignal
): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(signal.reason);
  }

  return new Promise<T>((resolve, reject) => {
    const handleAbort = () => reject(signal.reason);
    signal.addEventListener('abort', handleAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', handleAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', handleAbort);
        reject(error);
      }
    );
  });
}

function readGoogleResponseData<T>(response: unknown): T {
  if (typeof response !== 'object' || response === null || !('data' in response)) {
    throw new Error('Google API response was missing a body.');
  }
  return (response as { data: T }).data;
}

function readErrorRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function getUpstreamStatus(error: unknown): number | undefined {
  const response = readErrorRecord(readErrorRecord(error)?.response);
  return typeof response?.status === 'number' ? response.status : undefined;
}

function getErrorCode(error: unknown): string {
  const code = readErrorRecord(error)?.code;
  return typeof code === 'string' ? code : '';
}

function getErrorRequestUrl(error: unknown): string {
  const config = readErrorRecord(readErrorRecord(error)?.config);
  const url = config?.url;
  return url instanceof URL ? url.toString() : typeof url === 'string' ? url : '';
}

function getSafeUpstreamError(error: unknown): string | undefined {
  const response = readErrorRecord(readErrorRecord(error)?.response);
  const data = readErrorRecord(response?.data);
  const nestedError = readErrorRecord(data?.error);
  const status = nestedError?.status;
  const message = nestedError?.message;
  const parts = [
    typeof status === 'string' ? status : '',
    typeof message === 'string' ? message : ''
  ].filter(Boolean);
  return parts.length ? parts.join(': ').slice(0, 300) : undefined;
}

function classifySheetsFailure(
  error: unknown,
  upstreamStatus: number | undefined
): { kind: SheetsFailureKind; retryable: boolean } {
  const requestUrl = getErrorRequestUrl(error);
  if (
    requestUrl.includes('oauth2.googleapis.com') ||
    requestUrl.includes('accounts.google.com')
  ) {
    return { kind: 'authentication', retryable: false };
  }
  if (upstreamStatus === 401 || upstreamStatus === 403) {
    return { kind: 'permission', retryable: false };
  }
  if (upstreamStatus !== undefined) {
    return {
      kind: 'upstream',
      retryable: upstreamStatus === 429 || upstreamStatus >= 500
    };
  }

  const code = getErrorCode(error).toUpperCase();
  if (
    code === 'ENOTFOUND' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    error instanceof TypeError
  ) {
    return { kind: 'network', retryable: true };
  }
  return { kind: 'upstream', retryable: false };
}

export type GoogleSheetsApi<TTarget extends string> = {
  readSheetValues: (
    target: TTarget,
    range: string,
    operation?: SheetsOperation
  ) => Promise<string[][]>;
  readSheetValuesBatch: (
    target: TTarget,
    ranges: readonly string[],
    operation?: SheetsOperation
  ) => Promise<string[][][]>;
  updateSheetValuesBatch: (
    target: TTarget,
    updates: readonly SheetsBatchUpdate[],
    operation?: SheetsOperation
  ) => Promise<void>;
  appendSheetRow: (
    target: TTarget,
    range: string,
    rowValues: string[],
    operation?: SheetsOperation
  ) => Promise<void>;
  readSheetTitles: (target: TTarget, operation?: SheetsOperation) => Promise<string[]>;
  addSheet: (
    target: TTarget,
    title: string,
    operation?: SheetsOperation
  ) => Promise<void>;
  deleteSheetRow: (
    target: TTarget,
    sheetName: string,
    rowNumber: number,
    operation?: SheetsOperation
  ) => Promise<void>;
};

export function createGoogleSheetsApi<TTarget extends string>(
  options: GoogleSheetsApiOptions<TTarget>
): GoogleSheetsApi<TTarget> {
  let jwtClient: JWT | null = null;

  function getJwtClient() {
    if (jwtClient) {
      return jwtClient;
    }

    const credentials = options.getCredentials();
    jwtClient = new JWT({
      email: credentials.serviceAccountEmail,
      key: credentials.serviceAccountPrivateKey.replace(/\\n/g, '\n'),
      scopes: [...(options.scopes || ['https://www.googleapis.com/auth/spreadsheets'])]
    });

    return jwtClient;
  }

  function getSpreadsheetId(target: TTarget) {
    const id = options.getCredentials().spreadsheetIds[target];
    if (!id) {
      throw new Error('Spreadsheet ID is not configured for target: ' + target);
    }
    return id;
  }

  function buildValuesUrl(target: TTarget, range: string, query = '') {
    return buildGoogleSheetsValuesUrl(getSpreadsheetId(target), range, query);
  }

  function buildBatchValuesUrl(target: TTarget, ranges: readonly string[]) {
    const query = new URLSearchParams({ majorDimension: 'ROWS' });
    ranges.forEach((range) => query.append('ranges', range));
    return (
      'https://sheets.googleapis.com/v4/spreadsheets/' +
      getSpreadsheetId(target) +
      '/values:batchGet?' +
      query
    );
  }

  function buildBatchUpdateUrl(target: TTarget) {
    return (
      'https://sheets.googleapis.com/v4/spreadsheets/' +
      getSpreadsheetId(target) +
      '/values:batchUpdate'
    );
  }

  function buildSpreadsheetBatchUpdateUrl(target: TTarget) {
    return (
      'https://sheets.googleapis.com/v4/spreadsheets/' +
      getSpreadsheetId(target) +
      ':batchUpdate'
    );
  }

  async function callSheetsApi<T>(
    target: TTarget,
    action: SheetsRequestAction,
    url: string,
    init: { method: 'GET' | 'POST'; data?: unknown },
    operation?: SheetsOperation
  ): Promise<T> {
    const ownedOperation = operation ? null : createSheetsOperation(options.timeoutMs);
    const activeOperation = operation || ownedOperation!;
    const startedAt = Date.now();

    try {
      const client = getJwtClient();
      const response: unknown = await waitForSheetsOperation(
        client.request({
          url,
          method: init.method,
          data: init.data,
          signal: activeOperation.signal
        }),
        activeOperation.signal
      );
      return readGoogleResponseData<T>(response);
    } catch (error) {
      if (activeOperation.signal.aborted) {
        throw new SheetsRequestError(
          'Google Sheets authenticated request timed out.',
          'timeout',
          target,
          action,
          Date.now() - startedAt,
          true,
          undefined,
          undefined,
          'authenticated_request',
          activeOperation.signal.reason
        );
      }
      const upstreamStatus = getUpstreamStatus(error);
      const classification = classifySheetsFailure(error, upstreamStatus);
      throw new SheetsRequestError(
        'Google Sheets authenticated request failed.',
        classification.kind,
        target,
        action,
        Date.now() - startedAt,
        classification.retryable,
        upstreamStatus,
        getSafeUpstreamError(error),
        undefined,
        error
      );
    } finally {
      ownedOperation?.dispose();
    }
  }

  return {
    async readSheetValues(target, range, operation) {
      const payload = await callSheetsApi<SheetsValuesResponse>(
        target,
        'values.get',
        buildValuesUrl(target, range),
        {
          method: 'GET'
        },
        operation
      );
      return Array.isArray(payload.values) ? payload.values : [];
    },

    async readSheetValuesBatch(target, ranges, operation) {
      if (!ranges.length) {
        return [];
      }

      const payload = await callSheetsApi<SheetsBatchValuesResponse>(
        target,
        'values.batchGet',
        buildBatchValuesUrl(target, ranges),
        {
          method: 'GET'
        },
        operation
      );
      const valueRanges = Array.isArray(payload.valueRanges) ? payload.valueRanges : [];
      return ranges.map((_, index) => {
        const values = valueRanges[index]?.values;
        return Array.isArray(values) ? values : [];
      });
    },

    async updateSheetValuesBatch(target, updates, operation) {
      if (!updates.length) {
        return;
      }

      await callSheetsApi(
        target,
        'values.batchUpdate',
        buildBatchUpdateUrl(target),
        {
          method: 'POST',
          data: {
            valueInputOption: 'RAW',
            data: updates
          }
        },
        operation
      );
    },

    async appendSheetRow(target, range, rowValues, operation) {
      const url = buildGoogleSheetsAppendUrl(
        getSpreadsheetId(target),
        range,
        'valueInputOption=RAW&insertDataOption=INSERT_ROWS'
      );
      await callSheetsApi(
        target,
        'values.append',
        url,
        {
          method: 'POST',
          data: { values: [rowValues] }
        },
        operation
      );
    },

    async readSheetTitles(target, operation) {
      const spreadsheet = await callSheetsApi<SheetsSpreadsheetResponse>(
        target,
        'spreadsheets.get',
        'https://sheets.googleapis.com/v4/spreadsheets/' +
          getSpreadsheetId(target) +
          '?fields=sheets.properties.title',
        { method: 'GET' },
        operation
      );
      return (spreadsheet.sheets || [])
        .map((sheet) => sheet.properties?.title || '')
        .filter(Boolean);
    },

    async addSheet(target, title, operation) {
      await callSheetsApi(
        target,
        'spreadsheets.batchUpdate',
        buildSpreadsheetBatchUpdateUrl(target),
        {
          method: 'POST',
          data: {
            requests: [
              {
                addSheet: {
                  properties: { title }
                }
              }
            ]
          }
        },
        operation
      );
    },

    async deleteSheetRow(target, sheetName, rowNumber, operation) {
      const spreadsheet = await callSheetsApi<SheetsSpreadsheetResponse>(
        target,
        'spreadsheets.get',
        'https://sheets.googleapis.com/v4/spreadsheets/' +
          getSpreadsheetId(target) +
          '?fields=sheets.properties',
        { method: 'GET' },
        operation
      );
      const sheetId = spreadsheet.sheets?.find(
        (sheet) => sheet.properties?.title === sheetName
      )?.properties?.sheetId;
      if (sheetId === undefined) {
        throw new Error('Sheet not found: ' + sheetName);
      }

      await callSheetsApi(
        target,
        'spreadsheets.batchUpdate',
        buildSpreadsheetBatchUpdateUrl(target),
        {
          method: 'POST',
          data: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId,
                    dimension: 'ROWS',
                    startIndex: rowNumber - 1,
                    endIndex: rowNumber
                  }
                }
              }
            ]
          }
        },
        operation
      );
    }
  };
}
