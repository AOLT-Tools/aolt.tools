import { describe, expect, it } from 'vitest';
import { locationFromMapboxRetrieve } from '../src/mapboxSearchJs.js';
import { resolveOnlineTimePreset } from '../lib/dateRanges.js';

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
});
