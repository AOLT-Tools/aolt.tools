import { describe, expect, it } from 'vitest';
import {
  buildGoogleSheetsAppendUrl,
  buildGoogleSheetsValuesUrl,
  createSheetsOperation
} from '@aolt/integrations/sheets/operations';

describe('operation-based Google Sheets helpers', () => {
  it('builds encoded Google Sheets values URLs', () => {
    expect(
      buildGoogleSheetsValuesUrl('sheet-id', 'Leads Sheet!A:B', 'majorDimension=ROWS')
    ).toBe(
      'https://sheets.googleapis.com/v4/spreadsheets/sheet-id/values/Leads%20Sheet!A%3AB?majorDimension=ROWS'
    );
    expect(
      buildGoogleSheetsAppendUrl('sheet-id', 'Leads!A:B', 'valueInputOption=RAW')
    ).toBe(
      'https://sheets.googleapis.com/v4/spreadsheets/sheet-id/values/Leads!A%3AB:append?valueInputOption=RAW'
    );
  });

  it('creates disposable timeout operations', () => {
    const operation = createSheetsOperation(1000);
    expect(operation.timeoutMs).toBe(1000);
    expect(operation.signal.aborted).toBe(false);
    operation.dispose();
  });
});
