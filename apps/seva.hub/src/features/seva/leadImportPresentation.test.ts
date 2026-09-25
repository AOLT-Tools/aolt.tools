import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(resolve(import.meta.dirname, '../../seva.html'), 'utf8');

describe('Import leads presentation', () => {
  it('offers a sheet link, a result message, and a retry label', () => {
    expect(html).toContain('aria-label="Import leads"');
    expect(html).toContain('importSheetUrl');
    expect(html).toContain('submitLeadImport()');
    expect(html).toContain('importLeadsButtonLabel()');
    expect(html).toContain('Choose a month before importing leads.');
    expect(html).toContain('x-show="campaignType !== \'Members\'"');
    expect(html).not.toContain('Map columns');
    expect(html).not.toContain('column mapping');
  });
});
