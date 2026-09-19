import { parseIsoDate, type OnlineTimePreset } from './dateRanges.js';
import type {
  SearchMode,
  SelectedSearchLocation
} from './searchService.js';
import type { SearchSourceId } from './searchIntent.js';

export function parseSearchMode(value: unknown): SearchMode | undefined {
  return value === 'online' || value === 'in_person' ? value : undefined;
}

export function parseSearchSource(value: unknown): SearchSourceId | undefined {
  return value === 'aol' ||
    value === 'center' ||
    value === 'vvmvp' ||
    value === 'vds'
    ? value
    : undefined;
}

export function parseRadiusKm(value: unknown): number | undefined {
  const radius = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(radius) || radius <= 0 || radius > 250) return undefined;
  return radius;
}

export function parseDatePreset(value: unknown): OnlineTimePreset | undefined {
  return value === 'anytime' ||
    value === 'today' ||
    value === 'tomorrow' ||
    value === 'this_weekend' ||
    value === 'next_7_days' ||
    value === 'custom'
    ? value
    : undefined;
}

export { parseIsoDate };

export function readLocation(value: unknown): SelectedSearchLocation | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const label = typeof record.label === 'string' ? record.label.trim() : '';
  const latitude = Number(record.latitude);
  const longitude = Number(record.longitude);
  if (!label || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return undefined;
  }
  return {
    label,
    latitude,
    longitude,
    city: typeof record.city === 'string' ? record.city : undefined
  };
}
