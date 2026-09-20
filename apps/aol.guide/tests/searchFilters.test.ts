import { describe, expect, it, vi } from 'vitest';
import {
  LOCATION_SUGGEST_DEBOUNCE_MS,
  LOCATION_SUGGEST_MIN_CHARS,
  shouldSuggestLocationQuery,
  suggestMapboxTemporaryLocations
} from '../src/mapboxSearchJs.js';
import {
  parseIsoDate,
  resolveCustomDateRange,
  resolveOnlineTimePreset
} from '../lib/dateRanges.js';

describe('temporary location suggest', () => {
  it('waits 500ms and ignores queries shorter than 3 characters', async () => {
    const fetchImpl = vi.fn() as typeof fetch;
    expect(LOCATION_SUGGEST_DEBOUNCE_MS).toBe(500);
    expect(LOCATION_SUGGEST_MIN_CHARS).toBe(3);
    expect(shouldSuggestLocationQuery('MS')).toBe(false);
    expect(shouldSuggestLocationQuery('MSR')).toBe(true);
    expect(
      await suggestMapboxTemporaryLocations('MS', 'pk.test-token', { fetchImpl })
    ).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('requests temporary geocoding after a long enough query', async () => {
    const requested: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      requested.push(String(input));
      return new Response(
        JSON.stringify({
          features: [
            {
              geometry: { type: 'Point', coordinates: [77.621558, 13.041018] },
              properties: {
                name: 'MSR North City',
                coordinates: { latitude: 13.041018, longitude: 77.621558 },
                context: { place: { name: 'Bengaluru' } }
              }
            }
          ]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }) as typeof fetch;
    const suggestions = await suggestMapboxTemporaryLocations(
      'MSR North City',
      'pk.test-token',
      { fetchImpl }
    );
    expect(suggestions).toEqual([
      {
        label: 'MSR North City',
        latitude: 13.041018,
        longitude: 77.621558,
        city: 'Bengaluru'
      }
    ]);
    expect(requested[0]).toContain('permanent=false');
    expect(requested[0]).toContain('autocomplete=true');
    expect(requested[0]).not.toContain('permanent=true');
    expect(requested[0]).not.toContain('session_token');
    expect(requested[0]).not.toContain('search/searchbox');
  });
});

describe('online time presets', () => {
  const now = new Date('2026-09-04T06:30:00.000Z');

  it('leaves Anytime unfiltered', () => {
    expect(resolveOnlineTimePreset('anytime', now)).toBeUndefined();
  });

  it('maps Next 7 days from today in India', () => {
    expect(resolveOnlineTimePreset('next_7_days', now)).toEqual({
      start: '2026-09-04',
      end: '2026-09-10',
      label: 'Next 7 days'
    });
  });

  it('accepts a custom from/to duration and swaps reversed dates', () => {
    expect(parseIsoDate('2026-02-31')).toBeUndefined();
    expect(resolveOnlineTimePreset('custom', now)).toBeUndefined();
    expect(resolveCustomDateRange('2026-09-20', '2026-09-10')).toEqual({
      start: '2026-09-10',
      end: '2026-09-20',
      label: '2026-09-10 to 2026-09-20'
    });
  });
});
