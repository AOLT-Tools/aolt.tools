import { describe, expect, it } from 'vitest';
import { parseSearchQuery } from '../lib/queryParser.js';
import { routeSources } from '../lib/sourceRouter.js';

const now = new Date('2026-09-04T06:30:00.000Z');

describe('source routing', () => {
  it('routes HP to Art of Living', () => {
    const intent = parseSearchQuery('HP near 560045 within 10km', { now });
    expect(routeSources(intent)).toEqual(['aol']);
  });

  it('routes Bangalore Ashram queries to VVMVP first', () => {
    const intent = parseSearchQuery('AMP Bangalore Ashram next weekend', { now });
    expect(routeSources(intent)[0]).toBe('vvmvp');
    expect(routeSources(intent)).toContain('aol');
  });

  it('routes Rudra Puja to VDS', () => {
    const intent = parseSearchQuery('Rudra Puja this weekend', { now });
    expect(routeSources(intent)).toEqual(['vds']);
  });

  it('offers AOL and VVMVP for meditation Bangalore', () => {
    const intent = parseSearchQuery('meditation Bangalore', { now });
    expect(routeSources(intent)).toEqual(['aol', 'vvmvp']);
  });

  it('does not treat a Mapbox-selected Bengaluru city as an ashram query', () => {
    const intent = {
      ...parseSearchQuery('teacher Alex', { now }),
      city: 'Bengaluru',
      latitude: 12.9121,
      longitude: 77.6446
    };
    expect(routeSources(intent)).toEqual(['aol']);
  });

  it('still routes an explicit Bangalore query to VVMVP', () => {
    const intent = parseSearchQuery('teacher Alex Bangalore Ashram', { now });
    expect(routeSources(intent)[0]).toBe('vvmvp');
  });
});
