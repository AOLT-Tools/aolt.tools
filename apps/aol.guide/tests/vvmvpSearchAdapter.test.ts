import { describe, expect, it } from 'vitest';
import { vvmvpSearchText } from '../lib/sources/vvmvpSearchAdapter.js';
import { testIntent } from './helpers.js';

describe('VVMVP adapter', () => {
  it('uses the verified search query parameter', () => {
    expect(vvmvpSearchText(testIntent({ courseCode: 'AMP', courseLabel: 'AMP' }))).toBe(
      'AMP'
    );
  });

  it('uses a teacher name when present', () => {
    expect(vvmvpSearchText(testIntent({ teacher: 'Alex' }))).toBe('Alex');
  });
});
