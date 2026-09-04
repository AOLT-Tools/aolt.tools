import {
  isValidLatitude,
  isValidLongitude,
  type LatLng,
  type PincodeCoordinate,
  type PincodeCoordinateResolver
} from '@aolt/core/geo';
import { normalizePincode } from '@aolt/core/normalization';
import { withTimeout } from '@aolt/core/retry';

export const MAPBOX_GEOCODE_FORWARD_URL =
  'https://api.mapbox.com/search/geocode/v6/forward';

export type MapboxTemporaryPincodeResolverOptions = {
  accessToken: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export function createMapboxTemporaryPincodeResolver(
  options: MapboxTemporaryPincodeResolverOptions
): PincodeCoordinateResolver {
  const accessToken = options.accessToken.trim();
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs || 8_000;

  return {
    async resolve(pincode) {
      const pin = normalizePincode(pincode);
      if (!pin || !accessToken) return null;

      try {
        const response = await withTimeout(
          (signal) =>
            fetchImpl(buildMapboxTemporaryPincodeUrl(pin, accessToken), {
              headers: { accept: 'application/json' },
              signal
            }),
          timeoutMs,
          'MAPBOX_GEOCODE_TIMEOUT'
        );
        if (!response.ok) return null;
        return parseMapboxTemporaryPincodeResponse(pin, await response.json());
      } catch {
        return null;
      }
    }
  };
}

export function buildMapboxTemporaryPincodeUrl(
  pincode: string,
  accessToken: string
): string {
  const url = new URL(MAPBOX_GEOCODE_FORWARD_URL);
  url.searchParams.set('q', pincode);
  url.searchParams.set('country', 'in');
  url.searchParams.set('types', 'postcode');
  url.searchParams.set('limit', '1');
  url.searchParams.set('autocomplete', 'false');
  url.searchParams.set('permanent', 'false');
  url.searchParams.set('access_token', accessToken);
  return url.toString();
}

export function parseMapboxTemporaryPincodeResponse(
  pincode: string,
  payload: unknown
): PincodeCoordinate | null {
  const pin = normalizePincode(pincode);
  if (!pin) return null;

  const features = readRecord(payload)?.features;
  if (!Array.isArray(features)) return null;

  for (const item of features) {
    const feature = readRecord(item);
    if (!feature) continue;
    const properties = readRecord(feature.properties) || {};
    const featureType = readString(properties.feature_type);
    if (featureType && featureType !== 'postcode') continue;
    if (featurePincode(properties) !== pin) continue;

    const point = coordinatesFromFeature(feature, properties);
    if (!point) continue;

    return {
      pincode: pin,
      latitude: point.latitude,
      longitude: point.longitude,
      city: contextName(properties, 'place') || contextName(properties, 'locality'),
      state: contextName(properties, 'region')
    };
  }

  return null;
}

function featurePincode(properties: Record<string, unknown>): string {
  return (
    normalizePincode(readString(properties.name)) ||
    normalizePincode(contextName(properties, 'postcode') || '')
  );
}

function coordinatesFromFeature(
  feature: Record<string, unknown>,
  properties: Record<string, unknown>
): LatLng | null {
  const named = readRecord(properties.coordinates);
  if (named) {
    const latitude = Number(named.latitude);
    const longitude = Number(named.longitude);
    if (isValidLatitude(latitude) && isValidLongitude(longitude)) {
      return { latitude, longitude };
    }
  }

  const geometry = readRecord(feature.geometry);
  const pair = Array.isArray(geometry?.coordinates) ? geometry.coordinates : [];
  const longitude = Number(pair[0]);
  const latitude = Number(pair[1]);
  if (isValidLatitude(latitude) && isValidLongitude(longitude)) {
    return { latitude, longitude };
  }
  return null;
}

function contextName(
  properties: Record<string, unknown>,
  key: string
): string | undefined {
  const context = readRecord(properties.context);
  const value = context ? readString(readRecord(context[key])?.name) : '';
  return value || undefined;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
