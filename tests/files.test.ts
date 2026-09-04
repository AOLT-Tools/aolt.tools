import { describe, expect, it } from 'vitest';
import { safeFilename, validateUpload } from '@aolt/integrations/blob/files';

describe('file validation', () => {
  it('checks magic bytes instead of trusting the MIME header', () => {
    expect(() => validateUpload(new Uint8Array([1, 2, 3]), 'image/png', 100)).toThrow(
      'does not match'
    );
    expect(() =>
      validateUpload(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        'image/png',
        100
      )
    ).not.toThrow();
  });

  it('normalizes filenames used in blob paths', () => {
    expect(safeFilename('../../My report (final).pdf')).toBe(
      '..-..-My-report-final-.pdf'
    );
  });
});
