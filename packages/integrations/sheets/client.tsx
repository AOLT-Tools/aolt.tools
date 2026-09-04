import { JWT } from 'google-auth-library';
import { AppError } from '@aolt/core/errors';
import { getSheetsEnv } from '@aolt/core/env';
import { retrySafe, withTimeout } from '@aolt/core/retry';

export type SheetTarget = 'data' | 'access';
export type ValueUpdate = { range: string; values: string[][] };

function statusOf(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const response = (error as { response?: { status?: unknown } }).response;
  return typeof response?.status === 'number' ? response.status : undefined;
}

function canRetry(error: unknown): boolean {
  const status = statusOf(error);
  return status === 429 || (typeof status === 'number' && status >= 500);
}

export class SheetsClient {
  private readonly jwt: JWT;
  private readonly env = getSheetsEnv();

  constructor() {
    this.jwt = new JWT({
      email: this.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: this.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
  }

  spreadsheetId(target: SheetTarget): string {
    return target === 'access'
      ? this.env.GOOGLE_SHEETS_ACCESS_SPREADSHEET_ID
      : this.env.GOOGLE_SHEETS_DATA_SPREADSHEET_ID;
  }

  private valuesUrl(target: SheetTarget, range: string, suffix = ''): string {
    return (
      'https://sheets.googleapis.com/v4/spreadsheets/' +
      this.spreadsheetId(target) +
      '/values/' +
      encodeURIComponent(range) +
      suffix
    );
  }

  private async request<T>(
    url: string,
    init: { method: 'GET' | 'POST' | 'PUT'; data?: unknown },
    retryable: boolean
  ): Promise<T> {
    const perform = () =>
      withTimeout(
        async (signal) => {
          try {
            const response = await this.jwt.request<T>({
              url,
              method: init.method,
              data: init.data,
              signal
            });
            return response.data;
          } catch (error) {
            if (signal.aborted) {
              throw new AppError(
                'UPSTREAM_TIMEOUT',
                'Google Sheets request timed out.',
                504,
                true,
                'sheets_timeout',
                { cause: error }
              );
            }
            const status = statusOf(error);
            throw new AppError(
              'UPSTREAM_ERROR',
              status === 401 || status === 403
                ? 'Google Sheets credentials or permissions are invalid.'
                : 'Google Sheets is unavailable.',
              status === 401 || status === 403 ? 502 : 503,
              canRetry(error),
              'sheets_upstream',
              { cause: error }
            );
          }
        },
        10_000,
        'Google Sheets request timed out.'
      );
    return retryable
      ? retrySafe(perform, (error) => error instanceof AppError && error.retryable)
      : perform();
  }

  async read(target: SheetTarget, range: string): Promise<string[][]> {
    const result = await this.request<{ values?: unknown[][] }>(
      this.valuesUrl(target, range),
      { method: 'GET' },
      true
    );
    return (result.values || []).map((row) => row.map(String));
  }

  async append(target: SheetTarget, range: string, values: string[]) {
    await this.request(
      this.valuesUrl(
        target,
        range,
        ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS'
      ),
      { method: 'POST', data: { values: [values] } },
      false
    );
  }

  async update(target: SheetTarget, updates: readonly ValueUpdate[]) {
    const url =
      'https://sheets.googleapis.com/v4/spreadsheets/' +
      this.spreadsheetId(target) +
      '/values:batchUpdate';
    await this.request(
      url,
      {
        method: 'POST',
        data: { valueInputOption: 'RAW', data: updates }
      },
      true
    );
  }

  async writeRow(target: SheetTarget, range: string, values: string[]) {
    await this.request(
      this.valuesUrl(target, range, '?valueInputOption=RAW'),
      { method: 'PUT', data: { values: [values] } },
      true
    );
  }

  async sheetTitles(target: SheetTarget): Promise<Set<string>> {
    const result = await this.request<{
      sheets?: Array<{ properties?: { title?: string } }>;
    }>(
      'https://sheets.googleapis.com/v4/spreadsheets/' +
        this.spreadsheetId(target) +
        '?fields=sheets.properties.title',
      { method: 'GET' },
      true
    );
    return new Set(
      (result.sheets || [])
        .map((sheet) => String(sheet.properties?.title || ''))
        .filter(Boolean)
    );
  }

  async addSheet(target: SheetTarget, title: string) {
    await this.request(
      'https://sheets.googleapis.com/v4/spreadsheets/' +
        this.spreadsheetId(target) +
        ':batchUpdate',
      {
        method: 'POST',
        data: { requests: [{ addSheet: { properties: { title } } }] }
      },
      false
    );
  }

  async deleteRow(target: SheetTarget, sheetName: string, rowNumber: number) {
    const spreadsheetId = this.spreadsheetId(target);
    const metadata = await this.request<{
      sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
    }>(
      'https://sheets.googleapis.com/v4/spreadsheets/' +
        spreadsheetId +
        '?fields=sheets.properties(sheetId,title)',
      { method: 'GET' },
      true
    );
    const sheet = (metadata.sheets || []).find(
      (item) => item.properties?.title === sheetName
    );
    if (!Number.isInteger(sheet?.properties?.sheetId)) {
      throw new AppError('UPSTREAM_ERROR', 'Sheet tab was not found.', 502);
    }
    await this.request(
      'https://sheets.googleapis.com/v4/spreadsheets/' + spreadsheetId + ':batchUpdate',
      {
        method: 'POST',
        data: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: sheet!.properties!.sheetId,
                  dimension: 'ROWS',
                  startIndex: rowNumber - 1,
                  endIndex: rowNumber
                }
              }
            }
          ]
        }
      },
      false
    );
  }
}
