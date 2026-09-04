import { describe, expect, it } from 'vitest';
import { redact } from '@aolt/core/errors';

describe('safe logging', () => {
  it('removes common secret and email shapes', () => {
    const output = redact('Bearer abc123 client_secret=topsecret user@example.com');
    expect(output).not.toContain('abc123');
    expect(output).not.toContain('topsecret');
    expect(output).not.toContain('user@example.com');
  });
});
