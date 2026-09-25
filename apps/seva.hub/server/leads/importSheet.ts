import {
  acceptSheetGrid,
  fetchPublicSheetCsv,
  LeadImportError,
  parseCsv,
  requireSheetLocation,
  SHEET_SHARE_MESSAGE
} from '../../shared/contracts/leadImport.js';

export type ImportSheetDependencies = {
  fetch?: typeof fetch;
  readSharedGrid?: (spreadsheetId: string, gid: string) => Promise<unknown[][]>;
};

function coerceGrid(values: unknown[]): string[][] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.map((row) => {
    if (!Array.isArray(row)) {
      return [];
    }
    return row.map((cell) => (cell == null ? '' : String(cell)));
  });
}

async function readSharedGrid(spreadsheetId: string, gid: string): Promise<unknown[][]> {
  const { createSheetsOperation, readSharedSpreadsheetGrid } = await import(
    '../sheets/client.js'
  );
  const operation = createSheetsOperation(6_000);
  try {
    return await readSharedSpreadsheetGrid(spreadsheetId, gid, operation);
  } finally {
    operation.dispose();
  }
}

export async function loadImportSheetRows(
  sheetUrl: string,
  dependencies: ImportSheetDependencies = {}
): Promise<string[][]> {
  const location = requireSheetLocation(sheetUrl);
  const csv = await fetchPublicSheetCsv(location, dependencies.fetch || fetch);
  if (csv !== null) {
    return acceptSheetGrid(parseCsv(csv));
  }

  try {
    const grid = await (dependencies.readSharedGrid || readSharedGrid)(
      location.spreadsheetId,
      location.gid
    );
    return acceptSheetGrid(coerceGrid(grid));
  } catch (error) {
    if (error instanceof LeadImportError) {
      throw error;
    }
    throw new LeadImportError('SHEET_NOT_READABLE', SHEET_SHARE_MESSAGE);
  }
}
