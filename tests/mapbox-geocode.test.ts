import { describe, expect, it, vi } from 'vitest';

import {
  buildMapboxTemporaryPincodeUrl,
  createMapboxTemporaryPincodeResolver,
  parseMapboxTemporaryPincodeResponse
} from '@aolt/integrations/mapbox/geocode';

const TOKEN = 'pk.test-token';

function mapboxFeature(overrides: Record<string, unknown> = {}) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [77.621558, 13.041018] },
    properties: {
      name: '560045',
      feature_type: 'postcode',
      coordinates: { latitude: 13.041018, longitude: 77.621558 },
      context: {
        place: { name: 'Bengaluru' },
        region: { name: 'Karnataka' }
      }
    },
    ...overrides
  };
}

describe('Mapbox Temporary Geocoding PIN lookup', () => {
  it('builds a temporary forward-geocode URL for an Indian postcode', () => {
    const url = new URL(buildMapboxTemporaryPincodeUrl('560045', TOKEN));
    expect(url.origin + url.pathname).toBe(
      'https://api.mapbox.com/search/geocode/v6/forward'
    );
    expect(url.searchParams.get('q')).toBe('560045');
    expect(url.searchParams.get('country')).toBe('in');
    expect(url.searchParams.get('types')).toBe('postcode');
    expect(url.searchParams.get('limit')).toBe('1');
    expect(url.searchParams.get('autocomplete')).toBe('false');
    expect(url.searchParams.get('permanent')).toBe('false');
    expect(url.searchParams.get('access_token')).toBe(TOKEN);
  });

  it('parses a matching postcode feature and ignores unrelated places', () => {
    expect(
      parseMapboxTemporaryPincodeResponse('560045', {
        features: [mapboxFeature()]
      })
    ).toEqual({
      pincode: '560045',
      latitude: 13.041018,
      longitude: 77.621558,
      city: 'Bengaluru',
      state: 'Karnataka'
    });

    expect(
      parseMapboxTemporaryPincodeResponse('560045', {
        features: [
          mapboxFeature({
            properties: {
              name: 'Bengaluru',
              feature_type: 'place',
              coordinates: { latitude: 12.97, longitude: 77.59 }
            }
          })
        ]
      })
    ).toBeNull();
  });

  it('calls Mapbox once per PIN and does not request permanent storage', async () => {
    const requested: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requested.push(url);
      return new Response(JSON.stringify({ features: [mapboxFeature()] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }) as typeof fetch;

    const resolver = createMapboxTemporaryPincodeResolver({
      accessToken: TOKEN,
      fetchImpl
    });
    const match = await resolver.resolve('HP near 560045');

    expect(match).toMatchObject({
      pincode: '560045',
      latitude: 13.041018,
      longitude: 77.621558
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(requested[0]).toContain('permanent=false');
    expect(requested[0]).not.toContain('permanent=true');
  });

  it('skips the network when the token is missing', async () => {
    const fetchImpl = vi.fn() as typeof fetch;
    const resolver = createMapboxTemporaryPincodeResolver({
      accessToken: '',
      fetchImpl
    });
    expect(await resolver.resolve('560045')).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
