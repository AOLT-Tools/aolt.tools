import { describe, expect, it } from 'vitest';
import { parseSearchQuery } from '../lib/queryParser.js';
import { vvmvpSearchText } from '../lib/sources/vvmvpSearchAdapter.js';

const now = new Date('2026-09-04T06:30:00.000Z');

describe('VVMVP adapter', () => {
  it('uses the verified search query parameter', () => {
    const intent = parseSearchQuery('AMP Bangalore Ashram next weekend', { now });
    expect(vvmvpSearchText(intent)).toBe('AMP');
  });

  it('uses a teacher name when present', () => {
    const intent = parseSearchQuery('teacher Alex Bangalore Ashram', { now });
    expect(vvmvpSearchText(intent)).toBe('Alex');
  });
});
