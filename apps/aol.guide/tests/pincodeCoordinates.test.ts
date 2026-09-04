import { describe, expect, it, vi } from 'vitest';

import {
  createPincodeCoordinateResolver,
  createStaticPincodeCoordinateResolver,
  loadBundledPincodeCoordinateResolver
} from '../lib/pincodeCoordinates.js';

const TOKEN = 'pk.test-token';
const LOCAL_PIN = {
  pincode: '560045',
  latitude: 13.032583,
  longitude: 77.620806,
  city: 'BENGALURU URBAN',
  state: 'KARNATAKA'
};

function mapboxFeature() {
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
    }
  };
}

describe('local PIN fallback', () => {
  it('loads the bundled pincodes.json dataset', async () => {
    const local = loadBundledPincodeCoordinateResolver();
    expect(local.size?.()).toBeGreaterThan(1000);
    expect(await local.resolve('560045')).toMatchObject({
      pincode: '560045',
      latitude: expect.any(Number),
      longitude: expect.any(Number)
    });
  });

  it('uses local coordinates when no Mapbox token is set', async () => {
    const fetchImpl = vi.fn() as typeof fetch;
    const resolver = createPincodeCoordinateResolver({
      accessToken: '',
      fetchImpl,
      localResolver: createStaticPincodeCoordinateResolver([LOCAL_PIN])
    });
    expect(await resolver.resolve('560045')).toEqual(LOCAL_PIN);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('prefers Mapbox when a token is set, then falls back to local', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ features: [mapboxFeature()] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }) as typeof fetch;

    const withMapbox = createPincodeCoordinateResolver({
      accessToken: TOKEN,
      fetchImpl,
      localResolver: createStaticPincodeCoordinateResolver([LOCAL_PIN])
    });
    expect(await withMapbox.resolve('560045')).toMatchObject({
      latitude: 13.041018,
      longitude: 77.621558
    });

    const failingFetch = vi.fn(async () => {
      return new Response('error', { status: 401 });
    }) as typeof fetch;
    const fallback = createPincodeCoordinateResolver({
      accessToken: TOKEN,
      fetchImpl: failingFetch,
      localResolver: createStaticPincodeCoordinateResolver([LOCAL_PIN])
    });
    expect(await fallback.resolve('560045')).toEqual(LOCAL_PIN);
  });
});
