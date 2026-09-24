import { isValidLatitude, isValidLongitude } from '@aolt/core/geo';
import {
  inPersonCatalogTypeGroups,
  isRegularConnectListing
} from './courseCategories.js';
import {
  resolveCustomDateRange,
  resolveOnlineTimePreset,
  type OnlineTimePreset
} from './dateRanges.js';
import {
  onlineProgramLabel,
  onlineProgramTypeIds,
  parseOnlineProgramId,
  type OnlineProgramId
} from './onlinePrograms.js';
import type {
  OfficialCourseListing,
  ResolvedSearchIntent,
  SearchSourceId,
  SourceSearchResult
} from './searchIntent.js';
import {
  fetchAolListingsForRadius,
  fetchAolListingsForTypeGroups,
  type AolListingPage
} from './sources/aolListings.js';
import { aolSearchAdapter, buildAolFilters } from './sources/aolSearchAdapter.js';
import { fetchVvmvpBangaloreListings } from './sources/vvmvpListings.js';
import { adapterIdForSource, SEARCH_SOURCE_ADAPTERS } from './sourceRouter.js';

export type SearchMode = 'in_person' | 'online';

export type SelectedSearchLocation = {
  label: string;
  latitude: number;
  longitude: number;
  city?: string;
};

export type OfficialSearchRequest = {
  source: SearchSourceId;
  mode?: SearchMode;
  location?: SelectedSearchLocation;
  courseCode?: OnlineProgramId;
  datePreset?: OnlineTimePreset;
  dateFrom?: string;
  dateTo?: string;
  radiusKm?: number;
};

export type OfficialSearchServiceOptions = {
  now?: Date;
  fetchImpl?: typeof fetch;
  aolListingLimit?: number;
};

export type OfficialSearchResponse = {
  intent: ResolvedSearchIntent;
  interpretation: Array<{ label: string; value: string }>;
  sources: SourceSearchResult[];
  messages: string[];
};

export class OfficialSearchService {
  constructor(private readonly options: OfficialSearchServiceOptions = {}) {}

  async search(request: OfficialSearchRequest): Promise<OfficialSearchResponse> {
    const now = this.options.now || new Date();
    const intent = catalogIntent(request, now);
    const adapter = SEARCH_SOURCE_ADAPTERS.find(
      (item) => item.id === adapterIdForSource(request.source)
    );
    const messages = [...intent.messages];
    if (!adapter) {
      return {
        intent,
        interpretation: describeIntent(intent, request.location),
        sources: [],
        messages
      };
    }

    const source = adapter.buildResult(intent, now);
    await this.attachListings(source, intent, now, messages);
    if (request.source === 'aol' || request.source === 'center') {
      source.listings = filterAolCatalogListings(request.source, source.listings || []);
    }
    if (request.source === 'center') source.source = 'center';

    return {
      intent,
      interpretation: describeIntent(intent, request.location),
      sources: [source],
      messages
    };
  }

  private async attachListings(
    source: SourceSearchResult,
    intent: ResolvedSearchIntent,
    now: Date,
    messages: string[]
  ): Promise<void> {
    if (source.source === 'vvmvp') {
      await this.attachVvmvpListings(source, messages);
      return;
    }
    if (source.source !== 'aol' && source.source !== 'center') return;

    try {
      if (
        intent.deliveryMode === 'in_person' &&
        (typeof intent.latitude !== 'number' || typeof intent.longitude !== 'number')
      ) {
        source.listings = [];
        source.listingTotal = 0;
        return;
      }
      const filters = buildAolFilters(intent, now);
      const fetchOptions = {
        fetchImpl: this.options.fetchImpl,
        limit: this.options.aolListingLimit
      };
      // The listings API returns one page of 20. An untyped nearby search fills
      // that page with Happiness Program and Follow Up, so Intuition Process and
      // other categories never arrive. Ask for each category's course types.
      const page =
        source.source === 'aol' &&
        intent.deliveryMode === 'in_person' &&
        !(intent.courseTypeIds || []).length
          ? await fetchAolListingsForTypeGroups(
              filters,
              inPersonCatalogTypeGroups(),
              fetchOptions
            )
          : await fetchAolListingsForRadius(filters, fetchOptions);
      applyAolListingResult(source, intent, page, now);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : 'Could not load Art of Living listings.';
      source.listingError = detail;
      messages.push(
        'Official Art of Living listings could not be loaded. Use View official results to open the same search on artofliving.org.'
      );
    }
  }

  private async attachVvmvpListings(
    source: SourceSearchResult,
    messages: string[]
  ): Promise<void> {
    try {
      const page = await fetchVvmvpBangaloreListings({
        fetchImpl: this.options.fetchImpl
      });
      source.listings = page.listings;
      source.listingTotal = page.total;
      source.listingCategories = page.categories;
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : 'Could not load Bangalore Ashram listings.';
      source.listingError = detail;
      messages.push(
        'Official Bangalore Ashram listings could not be loaded. Use More on official site to open the same programs on programs.vvmvp.org.'
      );
    }
  }
}

function applyAolListingResult(
  source: SourceSearchResult,
  intent: ResolvedSearchIntent,
  page: AolListingPage,
  now: Date
): void {
  const card = aolSearchAdapter.buildResult(intent, now);
  source.url = card.url;
  source.filters = card.filters;
  source.reason = card.reason;
  source.confidence = card.confidence;
  source.unsupportedFilters = card.unsupportedFilters;
  source.listings = page.listings;
  source.listingTotal = page.total;
}

export function describeIntent(
  intent: ResolvedSearchIntent,
  location?: SelectedSearchLocation
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  if (intent.courseLabel || intent.courseCode) {
    rows.push({
      label: 'Looking for',
      value: intent.courseLabel || intent.courseCode || ''
    });
  } else if (intent.keywords?.length) {
    rows.push({ label: 'Looking for', value: intent.keywords.join(' ') });
  }
  if (intent.deliveryMode !== 'online') {
    if (location) rows.push({ label: 'Near', value: location.label });
    else if (intent.city) rows.push({ label: 'Near', value: intent.city });
    if (typeof intent.radiusKm === 'number') {
      rows.push({ label: 'Within', value: String(intent.radiusKm) + ' km' });
    }
  }
  if (intent.language) rows.push({ label: 'Language', value: intent.language });
  if (intent.deliveryMode && intent.deliveryMode !== 'any') {
    rows.push({
      label: 'Mode',
      value: intent.deliveryMode === 'online' ? 'Online' : 'In person'
    });
  }
  if (intent.dateLabel) rows.push({ label: 'Dates', value: intent.dateLabel });
  else if (intent.dateFrom && intent.dateTo) {
    rows.push({ label: 'Dates', value: intent.dateFrom + ' to ' + intent.dateTo });
  }
  if (intent.teacher) rows.push({ label: 'Teacher', value: intent.teacher });
  if (intent.ashramMentioned) {
    rows.push({ label: 'Place', value: 'Bangalore Ashram' });
  }
  return rows;
}

function catalogIntent(
  request: OfficialSearchRequest,
  now: Date
): ResolvedSearchIntent {
  const source = request.source;
  const mode = source === 'aol' ? request.mode || 'in_person' : 'in_person';
  const intent: ResolvedSearchIntent = applySearchControls(
    {
      rawQuery: '',
      source,
      confidence: 'high',
      courseTypeIds: [],
      ashramMentioned: source === 'vvmvp',
      vdsMentioned: source === 'vds',
      courseMentioned: source === 'aol' || source === 'center',
      pincodeResolved: false,
      messages: []
    },
    { ...request, mode },
    now
  );
  if (mode === 'in_person' && typeof request.radiusKm === 'number') {
    return { ...intent, radiusKm: request.radiusKm };
  }
  return intent;
}

export function applySearchControls(
  intent: ResolvedSearchIntent,
  request: OfficialSearchRequest,
  now: Date
): ResolvedSearchIntent {
  if (request.mode === 'online') {
    const custom =
      request.datePreset === 'custom'
        ? resolveCustomDateRange(request.dateFrom, request.dateTo)
        : undefined;
    const range =
      request.datePreset === 'custom'
        ? custom
        : resolveOnlineTimePreset(request.datePreset, now);
    const unfiltered =
      request.datePreset === 'anytime' ||
      (request.datePreset === 'custom' && !custom);
    const program = parseOnlineProgramId(request.courseCode);
    return {
      ...intent,
      deliveryMode: 'online',
      latitude: undefined,
      longitude: undefined,
      radiusKm: undefined,
      courseCode: program,
      courseLabel: program ? onlineProgramLabel(program) : undefined,
      courseTypeIds: program ? onlineProgramTypeIds(program) : [],
      dateFrom: unfiltered ? undefined : range?.start || intent.dateFrom,
      dateTo: unfiltered ? undefined : range?.end || intent.dateTo,
      dateLabel: unfiltered ? undefined : range?.label || intent.dateLabel
    };
  }
  if (request.mode !== 'in_person') return intent;

  let next: ResolvedSearchIntent = { ...intent, deliveryMode: 'in_person' };
  const location = request.location;
  if (
    location &&
    isValidLatitude(location.latitude) &&
    isValidLongitude(location.longitude)
  ) {
    next = {
      ...next,
      latitude: location.latitude,
      longitude: location.longitude,
      city: location.city || location.label,
      pincode: undefined,
      pincodeResolved: true,
      radiusKm:
        typeof request.radiusKm === 'number'
          ? request.radiusKm
          : typeof next.radiusKm === 'number'
            ? next.radiusKm
            : 10
    };
  }
  return next;
}

export function filterAolCatalogListings(
  sourceId: SearchSourceId,
  listings: OfficialCourseListing[]
): OfficialCourseListing[] {
  if (sourceId !== 'aol' && sourceId !== 'center') return listings;
  const keepConnects = sourceId === 'center';
  return listings.filter(
    (item) => isRegularConnectListing(item) === keepConnects
  );
}
