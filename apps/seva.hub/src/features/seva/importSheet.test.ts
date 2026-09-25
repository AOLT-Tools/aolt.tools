import { describe, expect, it, vi } from 'vitest';
import { loadImportSheetRows } from '../../../server/leads/importSheet';
import {
  LeadImportError,
  SHEET_SHARE_MESSAGE
} from '../../../shared/contracts/leadImport';

const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abc/edit#gid=7';

describe('import sheet loading', () => {
  it('uses a shared-sheet read when the public export is not CSV', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response('<html>Sign in</html>', { status: 200 });
    });
    const readSharedGrid = vi.fn(async () => [
      ['Name', 'Mobile', 'Location'],
      ['Ravi Kumar', '9123456789', 'Hebbal']
    ]);

    await expect(
      loadImportSheetRows(SHEET_URL, { fetch: fetchImpl, readSharedGrid })
    ).resolves.toEqual([
      ['Name', 'Mobile', 'Location'],
      ['Ravi Kumar', '9123456789', 'Hebbal']
    ]);
    expect(readSharedGrid).toHaveBeenCalledWith(
      '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abc',
      '7'
    );
  });

  it('asks the user to share the link when both reads fail', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response('<html>Sign in</html>', { status: 200 });
    });
    const readSharedGrid = vi.fn(async () => {
      throw new Error('permission');
    });

    await expect(
      loadImportSheetRows(SHEET_URL, { fetch: fetchImpl, readSharedGrid })
    ).rejects.toMatchObject({
      name: 'LeadImportError',
      message: SHEET_SHARE_MESSAGE
    });
    expect(readSharedGrid).toHaveBeenCalledOnce();
  });

  it('does not fetch a non-Google URL', async () => {
    const fetchImpl = vi.fn();
    await expect(
      loadImportSheetRows(
        'https://example.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrSt',
        {
          fetch: fetchImpl
        }
      )
    ).rejects.toBeInstanceOf(LeadImportError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
