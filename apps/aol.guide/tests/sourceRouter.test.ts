import { describe, expect, it } from 'vitest';
import { adapterIdForSource, routeSources } from '../lib/sourceRouter.js';

describe('source routing', () => {
  it('maps Courses and Center to the AOL adapter', () => {
    expect(adapterIdForSource('aol')).toBe('aol');
    expect(adapterIdForSource('center')).toBe('aol');
    expect(routeSources('aol')).toEqual(['aol']);
    expect(routeSources('center')).toEqual(['aol']);
  });

  it('keeps Ashram and Vaidic on their own adapters', () => {
    expect(routeSources('vvmvp')).toEqual(['vvmvp']);
    expect(routeSources('vds')).toEqual(['vds']);
  });
});
