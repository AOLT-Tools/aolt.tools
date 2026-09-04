import type { ApiDataStore } from '../../server/storage/dataStore.js';
import type { ApiRequest, ApiResponse } from '@aolt/core/api';
import type { SheetLayout } from '../../server/sheets/layout.js';
import type { SheetsOperation, SpreadsheetTarget } from '../../server/sheets/client.js';
import { getTabName } from '../../server/sheets/table.js';
import type { AuthorizationDiagnostics } from '../../server/sheets/store.js';
import type { SessionUser } from '../../server/auth/session.js';
import { methodNotAllowed, sendApiError } from '../../server/errors.js';

const MAX_HEALTH_DATA_ROWS = 200;

type MaybePromise<T> = T | Promise<T>;
type SheetsEnv = {
  GOOGLE_SHEETS_DATA_SPREADSHEET_ID: string;
  GOOGLE_SHEETS_ACCESS_SPREADSHEET_ID: string;
};

type HealthDependencies = {
  readSessionUser: (req: ApiRequest) => Promise<SessionUser | null>;
  getApiDataStore: () => MaybePromise<ApiDataStore>;
  getSheetsEnv: () => MaybePromise<SheetsEnv>;
  getSheetLayout: () => MaybePromise<SheetLayout>;
  createSheetsOperation: () => MaybePromise<SheetsOperation>;
  readSheetValuesBatch: (
    target: SpreadsheetTarget,
    ranges: readonly string[],
    operation?: SheetsOperation
  ) => Promise<string[][][]>;
};

function getHeaderRange(range: string): string {
  return getTabName(range) + '!1:1';
}

function getFirstColumnProbeRange(range: string): string {
  const separatorIndex = range.indexOf('!');
  const a1Range = separatorIndex >= 0 ? range.slice(separatorIndex + 1) : range;
  const firstColumn = a1Range.match(/^\$?([A-Za-z]+)/)?.[1]?.toUpperCase() || 'A';
  return (
    getTabName(range) +
    '!' +
    firstColumn +
    '1:' +
    firstColumn +
    String(MAX_HEALTH_DATA_ROWS + 1)
  );
}

function countDataRows(rows: string[][]): number {
  return rows
    .slice(1)
    .filter((row) => row.some((value) => String(value || '').trim().length > 0)).length;
}

export function createSheetsHealthHandler(overrides: Partial<HealthDependencies> = {}) {
  const dependencies: HealthDependencies = {
    async readSessionUser(req) {
      const { readSessionUser } = await import('../../server/auth/session.js');
      return readSessionUser(req);
    },
    async getApiDataStore() {
      const { getApiDataStore } = await import('../../server/storage/dataStore.js');
      return getApiDataStore();
    },
    async getSheetsEnv() {
      const { getSheetsEnv } = await import('../../server/env.js');
      return getSheetsEnv();
    },
    async getSheetLayout() {
      const { getSheetLayout } = await import('../../server/sheets/layout.js');
      return getSheetLayout();
    },
    async createSheetsOperation() {
      const { createSheetsOperation } = await import('../../server/sheets/client.js');
      return createSheetsOperation();
    },
    async readSheetValuesBatch(target, ranges, operation) {
      const { readSheetValuesBatch } = await import('../../server/sheets/client.js');
      return readSheetValuesBatch(target, ranges, operation);
    },
    ...overrides
  };

  async function loadDiagnostics(
    authorizationDiagnostics: AuthorizationDiagnostics | undefined,
    operation: SheetsOperation
  ) {
    const [env, layout] = await Promise.all([
      dependencies.getSheetsEnv(),
      dependencies.getSheetLayout()
    ]);
    const headerRanges = [
      getHeaderRange(layout.campaignsRange),
      getHeaderRange(layout.leadsRange),
      getHeaderRange(layout.membersRange),
      getHeaderRange(layout.coursesRange),
      getHeaderRange(layout.shortUrlsRange)
    ];
    const dataProbes = [
      authorizationDiagnostics
        ? null
        : {
            key: 'campaignRows' as const,
            range: getFirstColumnProbeRange(layout.campaignsRange)
          },
      {
        key: 'leadRows' as const,
        range: getFirstColumnProbeRange(layout.leadsRange)
      },
      {
        key: 'memberRows' as const,
        range: getFirstColumnProbeRange(layout.membersRange)
      },
      {
        key: 'courseRows' as const,
        range: getFirstColumnProbeRange(layout.coursesRange)
      },
      {
        key: 'shortUrlRows' as const,
        range: getFirstColumnProbeRange(layout.shortUrlsRange)
      },
      {
        key: 'configRows' as const,
        range: getFirstColumnProbeRange(layout.configRange)
      }
    ].filter((probe): probe is NonNullable<typeof probe> => Boolean(probe));
    const accessProbes = authorizationDiagnostics
      ? []
      : [
          {
            key: 'allowedUserRows' as const,
            range: getFirstColumnProbeRange(layout.allowedUsersRange)
          }
        ];
    const [dataRows, accessRows] = await Promise.all([
      dependencies.readSheetValuesBatch(
        'data',
        [...headerRanges, ...dataProbes.map((probe) => probe.range)],
        operation
      ),
      accessProbes.length
        ? dependencies.readSheetValuesBatch(
            'access',
            accessProbes.map((probe) => probe.range),
            operation
          )
        : Promise.resolve([])
    ]);
    const [campaignHeader, leadHeader, memberHeader, courseHeader, shortUrlHeader] =
      dataRows;
    const countRows: Record<string, number> = {};
    const truncated: Record<string, boolean> = {};
    dataProbes.forEach((probe, index) => {
      const rows = dataRows[headerRanges.length + index] || [];
      countRows[probe.key] = countDataRows(rows);
      truncated[probe.key] = rows.length >= MAX_HEALTH_DATA_ROWS + 1;
    });
    accessProbes.forEach((probe, index) => {
      const rows = accessRows[index] || [];
      countRows[probe.key] = countDataRows(rows);
      truncated[probe.key] = rows.length >= MAX_HEALTH_DATA_ROWS + 1;
    });

    return {
      dataSpreadsheetId: env.GOOGLE_SHEETS_DATA_SPREADSHEET_ID,
      accessSpreadsheetId: env.GOOGLE_SHEETS_ACCESS_SPREADSHEET_ID,
      tabs: {
        campaigns: getTabName(layout.campaignsRange),
        leads: getTabName(layout.leadsRange),
        members: getTabName(layout.membersRange),
        courses: getTabName(layout.coursesRange),
        shortUrls: getTabName(layout.shortUrlsRange),
        config: getTabName(layout.configRange),
        allowedUsers: getTabName(layout.allowedUsersRange)
      },
      headers: {
        campaigns: campaignHeader?.[0] || [],
        leads: leadHeader?.[0] || [],
        members: memberHeader?.[0] || [],
        courses: courseHeader?.[0] || [],
        shortUrls: shortUrlHeader?.[0] || []
      },
      counts: {
        campaignRows:
          authorizationDiagnostics?.campaignRows ?? countRows.campaignRows ?? 0,
        leadRows: countRows.leadRows ?? 0,
        memberRows: countRows.memberRows ?? 0,
        courseRows: countRows.courseRows ?? 0,
        shortUrlRows: countRows.shortUrlRows ?? 0,
        configRows: countRows.configRows ?? 0,
        allowedUserRows:
          authorizationDiagnostics?.allowedUserRows ?? countRows.allowedUserRows ?? 0
      },
      countProbeLimit: MAX_HEALTH_DATA_ROWS,
      truncated
    };
  }

  return async function handler(req: ApiRequest, res: ApiResponse) {
    const context = {
      route: 'GET /api/health/sheets',
      action: 'verify_sheets_health',
      startedAt: Date.now(),
      messages: {
        timeout:
          'Google Sheets connectivity verification took too long. Please try again.',
        upstream: 'Unable to verify Google Sheets connectivity. Please try again.',
        upstreamPermission:
          'Unable to verify Google Sheets access. Please contact an admin.',
        internal: 'Unable to verify Google Sheets connectivity.'
      }
    };

    if (req.method !== 'GET') {
      return methodNotAllowed(res, context, 'GET');
    }

    let operation: SheetsOperation | null = null;
    try {
      const user = await dependencies.readSessionUser(req);
      if (!user) {
        return sendApiError(res, new Error('Authentication required.'), context, {
          status: 401,
          code: 'UNAUTHENTICATED',
          message: 'Authentication required.',
          retryable: false,
          category: 'unauthenticated'
        });
      }

      operation = await dependencies.createSheetsOperation();
      const store = await dependencies.getApiDataStore();
      const authorization = await store.authorizeUser(user, operation);
      if (!authorization.allowed) {
        return sendApiError(res, new Error('Authorization denied.'), context, {
          status: 403,
          code: 'FORBIDDEN',
          message: 'Your account is not authorized to view Sheets diagnostics.',
          retryable: false,
          category: 'authorization_denied'
        });
      }

      return res.status(200).json({
        success: true,
        diagnostics: await loadDiagnostics(authorization.diagnostics, operation)
      });
    } catch (error) {
      return sendApiError(res, error, context);
    } finally {
      operation?.dispose();
    }
  };
}

export default createSheetsHealthHandler();
