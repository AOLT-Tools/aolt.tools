import {
  createGoogleSheetsApi,
  createSheetsOperation,
  SheetsRequestError,
  waitForSheetsOperation,
  type SheetsBatchUpdate,
  type SheetsFailureKind,
  type SheetsOperation,
  type SheetsRequestAction
} from '@aolt/integrations/sheets/operations';
import { getSheetsEnv } from '../env.js';

export type SpreadsheetTarget = 'data' | 'access';
export type {
  SheetsBatchUpdate,
  SheetsFailureKind,
  SheetsOperation,
  SheetsRequestAction
};
export { createSheetsOperation, SheetsRequestError, waitForSheetsOperation };

const sheetsApi = createGoogleSheetsApi<SpreadsheetTarget>({
  getCredentials() {
    const env = getSheetsEnv();
    return {
      serviceAccountEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      serviceAccountPrivateKey: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
      spreadsheetIds: {
        data: env.GOOGLE_SHEETS_DATA_SPREADSHEET_ID,
        access: env.GOOGLE_SHEETS_ACCESS_SPREADSHEET_ID
      }
    };
  }
});

export const readSheetValues = sheetsApi.readSheetValues;
export const readSheetValuesBatch = sheetsApi.readSheetValuesBatch;
export const updateSheetValuesBatch = sheetsApi.updateSheetValuesBatch;
export const appendSheetRow = sheetsApi.appendSheetRow;
export const deleteSheetRow = sheetsApi.deleteSheetRow;
