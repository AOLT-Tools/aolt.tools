import { isValidLatitude, isValidLongitude } from '@aolt/core/geo';
import {
  FOLLOW_UP_COURSE_TYPE_IDS,
  findCourseAliasByCode
} from './courseAliases.js';
import {
  resolveCustomDateRange,
  resolveOnlineTimePreset,
  type OnlineTimePreset
} from './dateRanges.js';
import {
  isDeterministicParseComplete,
  parseSearchQuery
} from './queryParser.js';
import type { PincodeCoordinateResolver } from './pincodeCoordinates.js';
import type {
  ResolvedSearchIntent,
  SearchSourceId,
  SourceSearchResult
} from './searchIntent.js';
import {
  fetchAolCourseListings,
  fetchAolListingsForRadius,
  refineAolListingPage,
  type AolListingPage
} from './sources/aolListings.js';
import { aolSearchAdapter, buildAolFilters } from './sources/aolSearchAdapter.js';
import { fetchVvmvpBangaloreListings } from './sources/vvmvpListings.js';
import { routeSources, SEARCH_SOURCE_ADAPTERS } from './sourceRouter.js';

export type IntentParser = {
  parse(query: string): Promise<ResolvedSearchIntent | null>;
};

export type SearchMode = 'in_person' | 'online';

export type SelectedSearchLocation = {
  label: string;
  latitude: number;
  longitude: number;
  city?: string;
};

export type OfficialSearchRequest = {
  query?: string;
  source?: SearchSourceId;
  mode?: SearchMode;
  location?: SelectedSearchLocation;
  datePreset?: OnlineTimePreset;
  dateFrom?: string;
  dateTo?: string;
  radiusKm?: number;
};

export type OfficialSearchServiceOptions = {
  pincodeResolver: PincodeCoordinateResolver;
  nlpParser?: IntentParser;
  now?: Date;
  fetchImpl?: typeof fetch;
  aolListingLimit?: number;
};

export type OfficialSearchResponse = {
  query: string;
  intent: ResolvedSearchIntent;
  interpretation: Array<{ label: string; value: string }>;
  sources: SourceSearchResult[];
  usedGemini: boolean;
  messages: string[];
};

export class OfficialSearchService {
  constructor(private readonly options: OfficialSearchServiceOptions) {}

  async search(
    input: string | OfficialSearchRequest
  ): Promise<OfficialSearchResponse> {
    const request = normalizeSearchRequest(input);
    if (request.source) {
      return this.searchCatalog(request);
    }
    return this.searchQuery(request);
  }

  private async searchQuery(
    request: OfficialSearchRequest
  ): Promise<OfficialSearchResponse> {
    const trimmed = request.query || '';
    const now = this.options.now || new Date();
    let intent = parseSearchQuery(trimmed, { now });
    let usedGemini = false;

    if (!isDeterministicParseComplete(intent) && this.options.nlpParser) {
      const parsed = await this.options.nlpParser.parse(trimmed);
      if (parsed) {
        intent = parsed;
        usedGemini = true;
      }
    }

    intent = applySearchControls(intent, request, now);
    if (
      request.mode !== 'online' &&
      (typeof intent.latitude !== 'number' || typeof intent.longitude !== 'number')
    ) {
      intent = await resolvePincodeCoordinates(intent, this.options.pincodeResolver);
    }

    const sourceIds = routeSources(intent);
    const adapters = sourceIds
      .map((id) => SEARCH_SOURCE_ADAPTERS.find((adapter) => adapter.id === id))
      .filter((adapter) => adapter != null);
    const sources = adapters.map((adapter) => adapter.buildResult(intent, now));
    const messages = [...intent.messages];
    if (usedGemini) {
      messages.push('Used Gemini only to interpret the query, not to search programs.');
    }

    let displayIntent = intent;
    await Promise.all(
      sources.map(async (source) => {
        const usedIntent = await this.attachOfficialListings(
          source,
          intent,
          now,
          messages
        );
        if (usedIntent) displayIntent = usedIntent;
      })
    );

    return {
      query: trimmed,
      intent: displayIntent,
      interpretation: describeIntent(displayIntent, request.location),
      sources,
      usedGemini,
      messages
    };
  }

  private async searchCatalog(
    request: OfficialSearchRequest
  ): Promise<OfficialSearchResponse> {
    const now = this.options.now || new Date();
    const sourceId = request.source || 'aol';
    const intent = catalogIntent(request, now);
    const adapter = SEARCH_SOURCE_ADAPTERS.find((item) => item.id === sourceId);
    const messages = [...intent.messages];
    if (!adapter) {
      return {
        query: '',
        intent,
        interpretation: describeIntent(intent, request.location),
        sources: [],
        usedGemini: false,
        messages
      };
    }

    const source = adapter.buildResult(intent, now);
    if (sourceId === 'aol') {
      await this.attachCatalogListings(source, intent, now, messages);
    } else if (sourceId === 'vvmvp') {
      await this.attachVvmvpCatalogListings(source, messages);
    }

    return {
      query: '',
      intent,
      interpretation: describeIntent(intent, request.location),
      sources: [source],
      usedGemini: false,
      messages
    };
  }

  private async attachCatalogListings(
    source: SourceSearchResult,
    intent: ResolvedSearchIntent,
    now: Date,
    messages: string[]
  ): Promise<void> {
    try {
      if (
        intent.deliveryMode === 'in_person' &&
        (typeof intent.latitude !== 'number' || typeof intent.longitude !== 'number')
      ) {
        source.listings = [];
        source.listingTotal = 0;
        return;
      }
      const page = await fetchAolListingsForRadius(buildAolFilters(intent, now), {
        fetchImpl: this.options.fetchImpl,
        limit: this.options.aolListingLimit
      });
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

  private async attachVvmvpCatalogListings(
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

  private async attachOfficialListings(
    source: SourceSearchResult,
    intent: ResolvedSearchIntent,
    now: Date,
    messages: string[]
  ): Promise<ResolvedSearchIntent | undefined> {
    if (source.source !== 'aol') return undefined;

    const followUpIntent = intent.teacher ? applyFollowUpProgramType(intent) : null;
    const fallbackIntent = followUpIntent
      ? fallbackIntentAfterFollowUp(intent)
      : undefined;

    try {
      let usedIntent = followUpIntent || intent;
      let page = await this.fetchAolPage(usedIntent, now);

      if (followUpIntent && fallbackIntent && !hasAolListings(page)) {
        usedIntent = fallbackIntent;
        page = await this.fetchAolPage(usedIntent, now);
        messages.push(
          'No Follow Up programs matched these filters, so other programs with the same location and date filters are shown.'
        );
      }

      applyAolListingResult(source, usedIntent, page, now);
      return usedIntent;
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : 'Could not load Art of Living listings.';
      source.listingError = detail;
      messages.push(
        'Official Art of Living listings could not be loaded. Use View official results to open the same search on artofliving.org.'
      );
      return undefined;
    }
  }

  private async fetchAolPage(
    intent: ResolvedSearchIntent,
    now: Date
  ): Promise<AolListingPage> {
    const page = await fetchAolCourseListings(buildAolFilters(intent, now), {
      fetchImpl: this.options.fetchImpl,
      limit: this.options.aolListingLimit
    });
    return refineAolListingPage(page, intent);
  }
}

export function applyFollowUpProgramType(
  intent: ResolvedSearchIntent
): ResolvedSearchIntent {
  const alias = findCourseAliasByCode('FOLLOW_UP');
  return {
    ...intent,
    courseCode: 'FOLLOW_UP',
    courseLabel: alias?.label || 'Follow Up',
    courseTypeIds: [...FOLLOW_UP_COURSE_TYPE_IDS],
    courseMentioned: true
  };
}

export function fallbackIntentAfterFollowUp(
  original: ResolvedSearchIntent
): ResolvedSearchIntent {
  if (original.courseCode && original.courseCode !== 'FOLLOW_UP') {
    return original;
  }
  return {
    ...original,
    courseCode: undefined,
    courseLabel: undefined,
    courseTypeIds: []
  };
}

function hasAolListings(page: AolListingPage): boolean {
  return page.listings.length > 0 || page.total > 0;
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

export async function resolvePincodeCoordinates(
  intent: ResolvedSearchIntent,
  resolver: PincodeCoordinateResolver
): Promise<ResolvedSearchIntent> {
  if (!intent.pincode) {
    return { ...intent, pincodeResolved: false };
  }

  const match = await resolver.resolve(intent.pincode);
  if (!match) {
    return {
      ...intent,
      latitude: undefined,
      longitude: undefined,
      pincodeResolved: false,
      messages: [
        ...intent.messages,
        'PIN ' +
          intent.pincode +
          ' is kept as the selected location, but coordinates could not be resolved. An unrelated location was not substituted.'
      ]
    };
  }

  return {
    ...intent,
    latitude: match.latitude,
    longitude: match.longitude,
    pincodeResolved: true,
    city: intent.city || match.city
  };
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
  } else if (intent.eventType) {
    const distinctive = (intent.keywords || []).find((keyword) =>
      ['rudra', 'guru', 'gau'].includes(keyword)
    );
    rows.push({
      label: 'Looking for',
      value: distinctive
        ? titleCase(distinctive) + ' ' + titleCase(intent.eventType)
        : titleCase(intent.eventType)
    });
  } else if (intent.keywords?.length) {
    rows.push({ label: 'Looking for', value: intent.keywords.join(' ') });
  }
  if (intent.deliveryMode !== 'online') {
    if (intent.pincode) rows.push({ label: 'Near', value: intent.pincode });
    else if (location) rows.push({ label: 'Near', value: location.label });
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

function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function normalizeSearchRequest(
  input: string | OfficialSearchRequest
): OfficialSearchRequest {
  if (typeof input === 'string') {
    return { query: input.trim() };
  }
  return {
    query: (input.query || '').trim(),
    source: input.source,
    mode: input.mode,
    location: input.location,
    datePreset: input.datePreset,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    radiusKm: input.radiusKm
  };
}

function catalogIntent(
  request: OfficialSearchRequest,
  now: Date
): ResolvedSearchIntent {
  const source = request.source || 'aol';
  const mode = source === 'aol' ? request.mode || 'in_person' : 'in_person';
  const intent: ResolvedSearchIntent = applySearchControls(
    {
      rawQuery: '',
      source,
      confidence: 'high',
      courseTypeIds: [],
      ashramMentioned: source === 'vvmvp',
      vdsMentioned: source === 'vds',
      courseMentioned: source === 'aol',
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
    return {
      ...intent,
      deliveryMode: 'online',
      latitude: undefined,
      longitude: undefined,
      radiusKm: undefined,
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
