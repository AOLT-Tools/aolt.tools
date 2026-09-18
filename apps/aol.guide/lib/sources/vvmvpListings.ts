import type { OfficialCourseListing } from '../searchIntent.js';
import { VVMVP_BANGALORE_URL } from './vvmvpSearchAdapter.js';

export const VVMVP_BANGALORE_SLUG = 'bangalore';
export const VVMVP_EVENT_ORIGIN = 'https://programs.vvmvp.org';
export const VVMVP_DONATE_CATEGORY_ID = '4';

export type VvmvpListingPage = {
  listings: OfficialCourseListing[];
  total: number;
  categories: string[];
};

export type FetchVvmvpListingsOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

type VvmvpEventList = {
  programs?: unknown[];
  languages?: unknown[];
  ashrams?: unknown[];
  events?: unknown[];
};

export async function fetchVvmvpBangaloreListings(
  options: FetchVvmvpListingsOptions = {}
): Promise<VvmvpListingPage> {
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs || 20_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(VVMVP_BANGALORE_URL, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'AOLGuide/0.2 (official-search wrapper)'
      },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(
        'Bangalore Ashram listings returned HTTP ' + String(response.status)
      );
    }
    return parseVvmvpBangalorePage(await response.text());
  } finally {
    clearTimeout(timer);
  }
}

export function parseVvmvpBangalorePage(html: string): VvmvpListingPage {
  const payload = parseVvmvpEventList(html);
  const programs = Array.isArray(payload.programs) ? payload.programs : [];
  const events = Array.isArray(payload.events) ? payload.events : [];
  const ashrams = Array.isArray(payload.ashrams) ? payload.ashrams : [];
  const languageNames = languageNameById(payload.languages);
  const categoryNames = categoryNameById(programs);
  const ashramId = bangaloreAshramId(ashrams);
  const listings = sortListingsByStart(
    events
      .filter((item) => isBangaloreEvent(item, ashramId))
      .map((item) => normalizeVvmvpListing(item, { categoryNames, languageNames }))
      .filter((listing): listing is OfficialCourseListing => listing != null)
  );
  return {
    listings,
    total: listings.length,
    categories: presentVvmvpCategories(listings, programs)
  };
}

export function parseVvmvpEventList(html: string): VvmvpEventList {
  const match = html.match(/var\s+vvmvp_event_list\s*=\s*/);
  if (!match || match.index == null) {
    throw new Error('Bangalore Ashram page did not include the official event list.');
  }
  const start = match.index + match[0].length;
  const json = sliceJsonObject(html, start);
  const payload = JSON.parse(json) as VvmvpEventList;
  if (!payload || typeof payload !== 'object') {
    throw new Error('Bangalore Ashram event list was not valid JSON.');
  }
  return payload;
}

export function normalizeVvmvpListing(
  raw: unknown,
  context: {
    categoryNames: Map<string, string>;
    languageNames: Map<string, string>;
  }
): OfficialCourseListing | null {
  const record = readRecord(raw);
  if (!record) return null;

  const id = readString(record.id);
  const title = readString(record.name) || readString(record.program);
  if (!id && !title) return null;

  const startDate = dateOnly(readString(record.event_start));
  const endDate = dateOnly(readString(record.event_end));
  const isOnline = readString(record.mode).toLowerCase() === 'online';
  const ashramName = readString(record.ashramName);
  const categoryId = readString(record.category_id);
  const category =
    context.categoryNames.get(categoryId) ||
    readString(record.category) ||
    readString(record.program_category) ||
    'Other';
  const path =
    categoryId === VVMVP_DONATE_CATEGORY_ID ? '/donate/' + id : '/events/' + id;
  const url = id ? VVMVP_EVENT_ORIGIN + path : VVMVP_BANGALORE_URL;

  return {
    id: id || title,
    title: title || 'Ashram program',
    startDate,
    endDate: endDate === startDate ? '' : endDate,
    city: cityFromAshramName(ashramName),
    address: ashramName,
    pincode: pincodeFromText(ashramName),
    location: isOnline ? 'Online' : ashramName || 'Bangalore Ashram',
    distanceKm: null,
    isOnline,
    languages: readLanguages(record.languages, context.languageNames),
    teachers: [],
    schedule: vvmvpSchedule(record, startDate, endDate),
    fee: '',
    registerUrl: url,
    detailUrl: url,
    category
  };
}

export function presentVvmvpCategories(
  listings: Array<{ category?: string }>,
  programs: unknown[]
): string[] {
  const present = new Set(
    listings.map((listing) => listing.category || '').filter(Boolean)
  );
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const program of programs) {
    const record = readRecord(program);
    const name = record ? readString(record.category) : '';
    if (!name || seen.has(name) || !present.has(name)) continue;
    seen.add(name);
    ordered.push(name);
  }
  for (const name of present) {
    if (!seen.has(name)) ordered.push(name);
  }
  return ordered;
}

export function vvmvpCategoryLabel(name: string): string {
  const trimmed = name.trim();
  const shortened = trimmed.replace(/\s+programs$/i, '').trim();
  return shortened || trimmed;
}

function bangaloreAshramId(ashrams: unknown[]): string {
  for (const item of ashrams) {
    const record = readRecord(item);
    if (!record) continue;
    if (readString(record.slug).toLowerCase() === VVMVP_BANGALORE_SLUG) {
      return readString(record.id);
    }
  }
  return '';
}

function isBangaloreEvent(raw: unknown, ashramId: string): boolean {
  const record = readRecord(raw);
  if (!record) return false;
  if (ashramId) return readString(record.ashram_id) === ashramId;
  return readString(record.slug).toLowerCase() === VVMVP_BANGALORE_SLUG;
}

function categoryNameById(programs: unknown[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const item of programs) {
    const record = readRecord(item);
    if (!record) continue;
    const id = readString(record.category_id);
    const name = readString(record.category);
    if (id && name && !names.has(id)) names.set(id, name);
  }
  return names;
}

function languageNameById(languages: unknown[] | undefined): Map<string, string> {
  const names = new Map<string, string>();
  if (!Array.isArray(languages)) return names;
  for (const item of languages) {
    const record = readRecord(item);
    if (!record) continue;
    const id = readString(record.id);
    const name = readString(record.language);
    if (id && name) names.set(id, name);
  }
  return names;
}

function readLanguages(value: unknown, names: Map<string, string>): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return unique(
    values
      .map((item) => {
        const id = readString(item);
        return names.get(id) || id;
      })
      .filter(Boolean)
  );
}

function vvmvpSchedule(
  record: Record<string, unknown>,
  startDate: string,
  endDate: string
): string {
  const from = readString(record.from);
  const to = readString(record.to);
  if (from && to) return compactJoin([from, to], ' to ');
  return dateLabel(startDate, endDate);
}

function cityFromAshramName(value: string): string {
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
  return parts[1] || parts[0] || 'Bangalore';
}

function pincodeFromText(value: string): string {
  const match = value.match(/\b[1-9]\d{5}\b/);
  return match ? match[0] : '';
}

function dateOnly(value: string): string {
  const match = value.match(/\b\d{4}-\d{2}-\d{2}\b/);
  return match ? match[0] : value;
}

function dateLabel(startDate: string, endDate: string): string {
  if (startDate && endDate && endDate !== startDate) {
    return startDate + ' to ' + endDate;
  }
  return startDate;
}

function sortListingsByStart(
  listings: OfficialCourseListing[]
): OfficialCourseListing[] {
  return [...listings].sort((left, right) => {
    const byDate = left.startDate.localeCompare(right.startDate);
    if (byDate !== 0) return byDate;
    return left.title.localeCompare(right.title);
  });
}

function sliceJsonObject(source: string, start: number): string {
  if (source[start] !== '{') {
    throw new Error('Bangalore Ashram event list was not valid JSON.');
  }
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error('Bangalore Ashram event list was truncated.');
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return typeof value === 'string' ? value.trim() : '';
}

function compactJoin(parts: string[], separator: string): string {
  return parts.map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean).join(separator);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
