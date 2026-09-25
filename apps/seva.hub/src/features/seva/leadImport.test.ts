import { describe, expect, it, vi } from 'vitest';
import {
  acceptSheetGrid,
  formatImportResult,
  LeadImportError,
  MAX_IMPORT_ROWS,
  parseCsv,
  parseGoogleSheetUrl,
  planLeadImport,
  readImportLeadsRequest,
  readPublicGoogleSheet,
  SHEET_SHARE_MESSAGE
} from '../../../shared/contracts/leadImport';

const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abc/edit?gid=42#gid=42';

describe('Google Sheet URL parsing', () => {
  it('accepts a docs.google.com spreadsheet link and its gid', () => {
    expect(parseGoogleSheetUrl(SHEET_URL)).toEqual({
      spreadsheetId: '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abc',
      gid: '42'
    });
  });

  it('rejects links that are not a Google spreadsheet', () => {
    expect(
      parseGoogleSheetUrl(
        'https://example.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrSt'
      )
    ).toBeNull();
    expect(
      parseGoogleSheetUrl(
        'http://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abc/edit'
      )
    ).toBeNull();
    expect(
      parseGoogleSheetUrl(
        'https://docs.google.com.evil.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abc/edit'
      )
    ).toBeNull();
    expect(parseGoogleSheetUrl('not a url')).toBeNull();
  });
});

describe('lead import planning', () => {
  it('maps aliases, keeps other columns as notes, and skips known mobiles', () => {
    const plan = planLeadImport(
      [
        ['Full Name', 'WhatsApp Number', 'Location', 'Course', 'Referred By'],
        ['Anita Rao', '9876543210', 'Hebbal', 'Happiness Program', 'Anita'],
        [
          'Ravi Kumar',
          '91 91234 56789',
          'Indiranagar',
          'Happiness Program',
          'Anita'
        ],
        ['Ravi Kumar', '9123456789', 'Whitefield', '', ''],
        ['', '9988776655', 'JP Nagar', '', '']
      ],
      new Set(['9876543210'])
    );

    expect(plan).toMatchObject({
      outcome: 'ready',
      skippedCount: 2,
      invalidCount: 1
    });
    if (plan.outcome !== 'ready') {
      return;
    }
    expect(plan.leads).toEqual([
      {
        name: 'Ravi Kumar',
        mobile: '9123456789',
        notes:
          'Location: Indiranagar\nCourse: Happiness Program\nReferred By: Anita'
      }
    ]);
  });

  it('uses cell values when the headers are swapped', () => {
    const plan = planLeadImport(
      [
        ['Mobile', 'Name'],
        ['Anita Rao', '9876543210'],
        ['Ravi Kumar', '9123456789'],
        ['Meera Iyer', '9988776655']
      ],
      new Set()
    );

    expect(plan).toMatchObject({ outcome: 'ready', skippedCount: 0 });
    if (plan.outcome !== 'ready') {
      return;
    }
    expect(plan.leads[0]).toEqual({
      name: 'Anita Rao',
      mobile: '9876543210',
      notes: ''
    });
  });

  it('asks for a rename when name-like columns are ambiguous', () => {
    const plan = planLeadImport(
      [
        ['Person', 'Place', 'Phone'],
        ['Anita Rao', 'Hebbal', '9876543210'],
        ['Ravi Kumar', 'Indiranagar', '9123456789'],
        ['Meera Iyer', 'Whitefield', '9988776655']
      ],
      new Set()
    );

    expect(plan).toEqual({
      outcome: 'needs_columns',
      missingColumns: ['Name']
    });
  });

  it('asks for a rename when two phone columns match', () => {
    const plan = planLeadImport(
      [
        ['Name', 'Phone', 'WhatsApp'],
        ['Anita Rao', '9876543210', '9123456789'],
        ['Ravi Kumar', '9988776655', '9090909090']
      ],
      new Set()
    );

    expect(plan).toEqual({
      outcome: 'needs_columns',
      missingColumns: ['Mobile']
    });
  });

  it('parses quoted CSV cells', () => {
    expect(
      parseCsv('Name,Mobile,Notes\n"Rao, Anita",9876543210,"Line 1\nLine 2"')
    ).toEqual([
      ['Name', 'Mobile', 'Notes'],
      ['Rao, Anita', '9876543210', 'Line 1\nLine 2']
    ]);
  });

  it('rejects sheets that are larger than the import cap', () => {
    const rows = [['Name', 'Mobile']];
    for (let index = 0; index < MAX_IMPORT_ROWS + 1; index += 1) {
      rows.push(['Person ' + String(index), '9000000000']);
    }
    expect(() => acceptSheetGrid(rows)).toThrow(LeadImportError);
  });
});

describe('import result copy', () => {
  it('counts imported and skipped leads', () => {
    expect(
      formatImportResult({
        outcome: 'imported',
        importedCount: 42,
        skippedCount: 3,
        invalidCount: 0,
        missingColumns: []
      }).message
    ).toBe('42 leads imported\n3 existing leads skipped');
  });

  it('names the column that could not be identified', () => {
    const formatted = formatImportResult({
      outcome: 'needs_columns',
      importedCount: 0,
      skippedCount: 0,
      invalidCount: 0,
      missingColumns: ['Mobile']
    });
    expect(formatted.needsRetry).toBe(true);
    expect(formatted.message).toContain('Could not identify the Mobile column');
    expect(formatted.message).toContain('Rename that column to Mobile');
  });
});

describe('public sheet reading', () => {
  it('reads a public CSV export and ignores other hosts', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response('Name,Mobile\nRavi Kumar,9123456789\n', {
        status: 200,
        headers: { 'Content-Type': 'text/csv' }
      });
    });

    await expect(readPublicGoogleSheet(SHEET_URL, fetchImpl)).resolves.toEqual([
      ['Name', 'Mobile'],
      ['Ravi Kumar', '9123456789']
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abc/export?format=csv&gid=42',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('tells the user to share the sheet when the export is not CSV', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response('<html>Sign in</html>', { status: 200 });
    });

    await expect(
      readPublicGoogleSheet(SHEET_URL, fetchImpl)
    ).rejects.toMatchObject({
      code: 'SHEET_NOT_READABLE',
      message: SHEET_SHARE_MESSAGE
    });
  });

  it('rejects a request that is not a spreadsheet link', () => {
    expect(() =>
      readImportLeadsRequest({
        sheetUrl: 'https://example.com/sheet',
        campaignId: 'cmpLeads01AbcDefGhIJk'
      })
    ).toThrow(LeadImportError);
  });
});
