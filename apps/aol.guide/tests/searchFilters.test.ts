import { describe, expect, it, vi } from 'vitest';
import {
  LOCATION_SUGGEST_DEBOUNCE_MS,
  LOCATION_SUGGEST_MIN_CHARS,
  locationFromMapboxRetrieve,
  shouldSuggestLocationQuery,
  suggestMapboxTemporaryLocations
} from '../src/mapboxSearchJs.js';
import {
  parseIsoDate,
  resolveCustomDateRange,
  resolveOnlineTimePreset
} from '../lib/dateRanges.js';

describe('browser Mapbox retrieve parsing', () => {
  it('reads coordinates from a Search Box retrieve payload', () => {
    expect(
      locationFromMapboxRetrieve({
        features: [
          {
            geometry: { type: 'Point', coordinates: [77.6446, 12.9121] },
            properties: {
              name: 'HSR Layout',
              coordinates: { latitude: 12.9121, longitude: 77.6446 },
              context: {
                place: { name: 'Bengaluru' },
                postcode: { name: '560102' }
              }
            }
          }
        ]
      })
    ).toEqual({
      label: 'HSR Layout',
      latitude: 12.9121,
      longitude: 77.6446,
      city: 'Bengaluru'
    });
  });

  it('reads lat/lng aliases and ignores the Mapbox postcode', () => {
    expect(
      locationFromMapboxRetrieve({
        features: [
          {
            geometry: { type: 'Point', coordinates: [77.621558, 13.041018] },
            properties: {
              name: 'MSR North City',
              coordinates: { lat: 13.041018, lng: 77.621558 },
              context: {
                place: { name: 'Bengaluru' },
                postcode: { name: '560077' }
              }
            }
          }
        ]
      })
    ).toEqual({
      label: 'MSR North City',
      latitude: 13.041018,
      longitude: 77.621558,
      city: 'Bengaluru'
    });
  });
});

describe('temporary location suggest', () => {
  it('waits 300ms and ignores queries shorter than 3 characters', async () => {
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
