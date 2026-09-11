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
  pincode?: string;
  city?: string;
};

export async function loadMapboxSearchJs(): Promise<MapboxSearchJs> {
  const { MapboxSearchBox, autofill } = await import('@mapbox/search-js-web');
  return {
    MapboxSearchBox: MapboxSearchBox as unknown as MapboxSearchJs['MapboxSearchBox'],
    autofill
  };
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
    readString(properties.full_address);
  const point = coordinatesFromFeature(feature, properties);
  if (!name || !point) return undefined;
  const context = asRecord(properties.context) || {};
  return {
    label: name,
    latitude: point.latitude,
    longitude: point.longitude,
    pincode: contextName(context, 'postcode'),
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
  const named = asRecord(properties.coordinates);
  const namedLat = Number(named?.latitude);
  const namedLng = Number(named?.longitude);
  if (Number.isFinite(namedLat) && Number.isFinite(namedLng)) {
    return { latitude: namedLat, longitude: namedLng };
  }
  const geometry = asRecord(feature.geometry);
  const pair = Array.isArray(geometry?.coordinates) ? geometry.coordinates : [];
  const longitude = Number(pair[0]);
  const latitude = Number(pair[1]);
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
