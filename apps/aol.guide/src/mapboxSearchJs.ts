import {
  buildMapboxTemporaryForwardUrl,
  parseMapboxTemporaryForwardSuggestions
} from '@aolt/integrations/mapbox/geocode';

export const LOCATION_SUGGEST_DEBOUNCE_MS = 300;
export const LOCATION_SUGGEST_MIN_CHARS = 3;

export type MapboxSearchBoxElement = HTMLElement & {
  accessToken: string;
  placeholder: string;
  options: Record<string, unknown>;
  theme?: {
    variables?: Record<string, string>;
    cssText?: string;
  };
};

export type MapboxSearchJs = {
  autofill: (options: {
    accessToken: string;
    options?: { country?: string; language?: string };
  }) => unknown;
  MapboxSearchBox: new () => MapboxSearchBoxElement;
};

export type BrowserLocation = {
  label: string;
  latitude: number;
  longitude: number;
  city?: string;
};

export async function loadMapboxSearchJs(): Promise<MapboxSearchJs> {
  const { MapboxSearchBox, autofill } = await import('@mapbox/search-js-web');
  return {
    MapboxSearchBox: MapboxSearchBox as unknown as MapboxSearchJs['MapboxSearchBox'],
    autofill
  };
}

export function shouldSuggestLocationQuery(value: string): boolean {
  return value.trim().length >= LOCATION_SUGGEST_MIN_CHARS;
}

export async function suggestMapboxTemporaryLocations(
  query: string,
  accessToken: string,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {}
): Promise<BrowserLocation[]> {
  const trimmed = query.trim();
  if (!shouldSuggestLocationQuery(trimmed) || !accessToken.startsWith('pk.')) {
    return [];
  }
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(
    buildMapboxTemporaryForwardUrl(trimmed, accessToken),
    {
      headers: { accept: 'application/json' },
      signal: options.signal
    }
  );
  if (!response.ok) return [];
  return parseMapboxTemporaryForwardSuggestions(await response.json());
}

export function locationFromMapboxRetrieve(
  detail: unknown
): BrowserLocation | undefined {
  const feature = firstFeature(detail);
  if (!feature) return undefined;
  const properties = asRecord(feature.properties) || feature;
  const name =
    readString(properties.name) ||
    readString(properties.place_name) ||
    readString(properties.place_formatted) ||
    readString(properties.full_address) ||
    readString(properties.address);
  const point = coordinatesFromFeature(feature, properties);
  if (!name || !point) return undefined;
  const context = asRecord(properties.context) || {};
  return {
    label: name,
    latitude: point.latitude,
    longitude: point.longitude,
    city: contextName(context, 'place') || contextName(context, 'locality')
  };
}

function firstFeature(detail: unknown): Record<string, unknown> | undefined {
  const record = asRecord(detail);
  if (!record) return undefined;
  const features = record.features;
  if (Array.isArray(features) && asRecord(features[0])) {
    return asRecord(features[0]);
  }
  if (record.geometry || record.properties) return record;
  return undefined;
}

function coordinatesFromFeature(
  feature: Record<string, unknown>,
  properties: Record<string, unknown>
): { latitude: number; longitude: number } | undefined {
  return (
    namedCoordinates(asRecord(properties.coordinates)) ||
    namedCoordinates(asRecord(feature.coordinates)) ||
    namedCoordinates(properties) ||
    pairCoordinates(properties.coordinates) ||
    pairCoordinates(asRecord(feature.geometry)?.coordinates)
  );
}

function namedCoordinates(
  record: Record<string, unknown> | undefined
): { latitude: number; longitude: number } | undefined {
  if (!record) return undefined;
  const latitude = Number(record.latitude ?? record.lat);
  const longitude = Number(record.longitude ?? record.lng ?? record.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  return { latitude, longitude };
}

function pairCoordinates(
  value: unknown
): { latitude: number; longitude: number } | undefined {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const longitude = Number(value[0]);
  const latitude = Number(value[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  return { latitude, longitude };
}

function contextName(
  context: Record<string, unknown>,
  key: string
): string | undefined {
  const value = readString(asRecord(context[key])?.name);
  return value || undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
