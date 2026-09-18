import { categorizeCourse } from '../courseCategories.js';
import type {
  DeliveryMode,
  OfficialCourseListing,
  ResolvedSearchIntent
} from '../searchIntent.js';

export const AOL_COURSE_API_URL = 'https://www.artofliving.org/new-search-course';
export const AOL_LISTING_PAGE_SIZE = 20;
export const AOL_MAX_RING_PAGES = 5;

const HASH_ONLY_KEYS = new Set(['selectedLocName', 'mode']);

const LANGUAGE_LABELS: Record<string, string> = {
  as: 'Assamese',
  bn: 'Bengali',
  en: 'English',
  gu: 'Gujarati',
  hi: 'Hindi',
  kn: 'Kannada',
  ks: 'Kashmiri',
  ml: 'Malayalam',
  mr: 'Marathi',
  ne: 'Nepali',
  or: 'Odia',
  pa: 'Punjabi',
  sa: 'Sanskrit',
  sd: 'Sindhi',
  ta: 'Tamil',
  te: 'Telugu',
  ur: 'Urdu',
  kok: 'Konkani',
  mai: 'Maithili'
};

export type { OfficialCourseListing };

export type AolListingPage = {
  listings: OfficialCourseListing[];
  total: number;
};

export type FetchAolListingsOptions = {
  fetchImpl?: typeof fetch;
  limit?: number;
  offset?: number;
  timeoutMs?: number;
};

export function buildAolApiSearchUrl(
  filters: Record<string, string>,
  options: { limit?: number; offset?: number } = {}
): string {
  const url = new URL(AOL_COURSE_API_URL);
  for (const [key, value] of Object.entries(filters)) {
    if (HASH_ONLY_KEYS.has(key) || value === '') continue;
    url.searchParams.set(key, value);
  }
  url.searchParams.set('limit', String(options.limit || AOL_LISTING_PAGE_SIZE));
  url.searchParams.set('offset', String(options.offset || 1));
  return url.toString();
}

export async function fetchAolCourseListings(
  filters: Record<string, string>,
  options: FetchAolListingsOptions = {}
): Promise<AolListingPage> {
  const fetchImpl = options.fetchImpl || fetch;
  const url = buildAolApiSearchUrl(filters, {
    limit: options.limit,
    offset: options.offset
  });
  const timeoutMs = options.timeoutMs || 20_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'AOLGuide/0.2 (official-search wrapper)'
      },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error('Art of Living listings returned HTTP ' + String(response.status));
    }
    const payload = (await response.json()) as {
      courses?: unknown[];
      total?: number;
    };
    const courses = Array.isArray(payload.courses) ? payload.courses : [];
    return {
      listings: sortListingsByDistance(
        courses
          .map(normalizeAolListing)
          .filter((listing): listing is OfficialCourseListing => listing != null)
      ),
      total: Number(payload.total) || courses.length
    };
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeAolListing(raw: unknown): OfficialCourseListing | null {
  const record = readRecord(raw);
  if (!record) return null;

  const title = readString(record.title);
  const id =
    readString(record.sao_id) ||
    readString(record.course_id) ||
    readString(record.id);
  if (!title && !id) return null;

  const registerUrl = absoluteUrl(readString(record.register_url));
  const detailUrl = absoluteUrl(readString(record.link));
  const startDate = dateOnly(readString(record.start_date));
  const endDate = dateOnly(readString(record.end_date));
  const city = readString(record.city);
  const address = readString(record.address_short) || readString(record.address);
  const pincode = readString(record.zip_postal_code);
  const isOnline = record.is_online_event === 1 || record.is_online_event === '1';
    const weekday = readString(record.weekday_timings);
  const weekend = readString(record.weekend_timings);
  const timings =
    weekday && weekend && weekday === weekend
      ? weekday
      : compactJoin([weekday, weekend], ' / ');
  const courseTypeId = readString(record.ctype) || undefined;
  const displayTitle = title || 'Art of Living program';

  return {
    id: id || registerUrl || title,
    title: displayTitle,
    startDate,
    endDate: endDate === startDate ? '' : endDate,
    city,
    address,
    pincode,
    location: formatLocation(address, city, pincode, isOnline),
    distanceKm: metersToKm(record.dist),
    isOnline,
    languages: readLanguages(record.course_language),
    teachers: readTeachers(record),
    schedule: compactJoin(
      [
        dateLabel(startDate, endDate),
        readString(record.formatted_date) || readString(record.course_timings) || timings
      ],
      ' · '
    ),
    fee: formatFee(record.course_fee, record.currency),
    registerUrl,
    detailUrl,
    courseTypeId,
    category: categorizeCourse({ title: displayTitle, courseTypeId })
  };
}

export async function fetchAolListingsForRadius(
  filters: Record<string, string>,
  options: FetchAolListingsOptions = {}
): Promise<AolListingPage> {
  const pageSize = options.limit || AOL_LISTING_PAGE_SIZE;
  const maxPages = AOL_MAX_RING_PAGES;
  const byId = new Map<string, OfficialCourseListing>();
  let total = 0;

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await fetchAolCourseListings(filters, {
      ...options,
      limit: pageSize,
      offset: page
    });
    total = result.total;
    for (const listing of result.listings) {
      const previous = byId.get(listing.id);
      if (!previous || closerListing(listing, previous)) {
        byId.set(listing.id, listing);
      }
    }
    if (result.listings.length < pageSize) break;
  }

  return {
    listings: sortListingsByDistance([...byId.values()]),
    total
  };
}

function closerListing(
  candidate: OfficialCourseListing,
  current: OfficialCourseListing
): boolean {
  if (!isFiniteDistance(candidate.distanceKm)) return false;
  if (!isFiniteDistance(current.distanceKm)) return true;
  return candidate.distanceKm < current.distanceKm;
}

export function sortListingsByDistance(
  listings: readonly OfficialCourseListing[]
): OfficialCourseListing[] {
  return [...listings].sort((left, right) => {
    if (isFiniteDistance(left.distanceKm) && isFiniteDistance(right.distanceKm)) {
      return left.distanceKm - right.distanceKm;
    }
    if (isFiniteDistance(left.distanceKm)) return -1;
    if (isFiniteDistance(right.distanceKm)) return 1;
    return 0;
  });
}

export function filterListingsByIntent(
  listings: readonly OfficialCourseListing[],
  intent: ResolvedSearchIntent
): OfficialCourseListing[] {
  return listings.filter((listing) => listingMatchesIntent(listing, intent));
}

export function refineAolListingPage(
  page: AolListingPage,
  intent: ResolvedSearchIntent
): AolListingPage {
  const listings = filterListingsByIntent(page.listings, intent);
  if (listings.length === page.listings.length) return { ...page, listings };
  return { listings, total: listings.length };
}

function listingMatchesIntent(
  listing: OfficialCourseListing,
  intent: ResolvedSearchIntent
): boolean {
  return (
    teacherMatchesIntent(listing.teachers, intent.teacher) &&
    languageMatchesIntent(listing.languages, intent.language) &&
    deliveryMatchesIntent(listing.isOnline, intent.deliveryMode)
  );
}

function teacherMatchesIntent(
  teachers: readonly string[],
  teacher?: string
): boolean {
  const needle = teacher?.trim().toLowerCase();
  if (!needle) return true;
  if (!teachers.length) return true;
  return teachers.some((name) => {
    const hay = name.trim().toLowerCase();
    return hay === needle || hay.includes(needle);
  });
}

function languageMatchesIntent(
  languages: readonly string[],
  language?: string
): boolean {
  const needle = language?.trim().toLowerCase();
  if (!needle || !languages.length) return true;
  return languages.some((item) => item.trim().toLowerCase() === needle);
}

function deliveryMatchesIntent(
  isOnline: boolean,
  deliveryMode?: DeliveryMode
): boolean {
  if (deliveryMode === 'online') return isOnline;
  if (deliveryMode === 'in_person') return !isOnline;
  return true;
}

function isFiniteDistance(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value);
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

function readLanguages(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return unique(
    values
      .map((item) => {
        const code = readString(item).toLowerCase();
        return LANGUAGE_LABELS[code] || readString(item);
      })
      .filter(Boolean)
  );
}

function readTeachers(record: Record<string, unknown>): string[] {
  const teachers = record.teachers;
  if (Array.isArray(teachers)) {
    return unique(
      teachers
        .map((item) => {
          if (typeof item === 'string') return item.trim();
          const nested = readRecord(item);
          return nested ? readString(nested.name) : '';
        })
        .filter(Boolean)
    );
  }
  return [];
}

function metersToKm(value: unknown): number | null {
  const meters = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(meters) || meters < 0) return null;
  return Math.round((meters / 1000) * 10) / 10;
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

function formatLocation(
  address: string,
  city: string,
  pincode: string,
  isOnline: boolean
): string {
  if (isOnline) return 'Online';
  const place = address || city;
  if (pincode && place.includes(pincode)) return place;
  return compactJoin([place, pincode], ', ');
}

function formatFee(fee: unknown, currency: unknown): string {
  const amount = readString(fee);
  if (!amount || amount === '0' || amount === '0.00') return '';
  const numeric = Number(amount);
  const pretty = Number.isFinite(numeric)
    ? String(Math.round(numeric))
    : amount;
  return readString(currency) === 'INR' ? '₹' + pretty : compactJoin([pretty, readString(currency)], ' ');
}

function absoluteUrl(value: string): string {
  if (!value) return '';
  const candidate = value.startsWith('www.') ? 'https://' + value : value;
  try {
    return new URL(candidate).toString();
  } catch {
    return value;
  }
}

function compactJoin(parts: string[], separator: string): string {
  return parts.map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean).join(separator);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
