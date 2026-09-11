import type { OnlineTimePreset } from './dateRanges.js';
import type { SearchMode, SelectedSearchLocation } from './searchService.js';

export function parseSearchMode(value: unknown): SearchMode | undefined {
  return value === 'online' || value === 'in_person' ? value : undefined;
}

export function parseDatePreset(value: unknown): OnlineTimePreset | undefined {
  return value === 'anytime' ||
    value === 'today' ||
    value === 'tomorrow' ||
    value === 'this_weekend' ||
    value === 'next_7_days'
    ? value
    : undefined;
}

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
    pincode: typeof record.pincode === 'string' ? record.pincode : undefined,
    city: typeof record.city === 'string' ? record.city : undefined
  };
}
