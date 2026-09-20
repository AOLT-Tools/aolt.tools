import {
  buildMapboxTemporaryForwardUrl,
  parseMapboxTemporaryForwardSuggestions,
  type MapboxTemporaryForwardSuggestion
} from '@aolt/integrations/mapbox/geocode';

export const LOCATION_SUGGEST_DEBOUNCE_MS = 500;
export const LOCATION_SUGGEST_MIN_CHARS = 3;

export type BrowserLocation = MapboxTemporaryForwardSuggestion;

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
