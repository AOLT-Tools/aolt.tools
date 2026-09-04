import {
  FOLLOW_UP_COURSE_TYPE_IDS,
  findCourseAliasByCode
} from './courseAliases.js';
import {
  isDeterministicParseComplete,
  parseSearchQuery
} from './queryParser.js';
import type { PincodeCoordinateResolver } from './pincodeCoordinates.js';
import type {
  ResolvedSearchIntent,
  SourceSearchResult
} from './searchIntent.js';
import {
  fetchAolCourseListings,
  type AolListingPage
} from './sources/aolListings.js';
import { aolSearchAdapter, buildAolFilters } from './sources/aolSearchAdapter.js';
import { routeSources, SEARCH_SOURCE_ADAPTERS } from './sourceRouter.js';

export type IntentParser = {
  parse(query: string): Promise<ResolvedSearchIntent | null>;
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

  async search(query: string): Promise<OfficialSearchResponse> {
    const trimmed = query.trim();
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

    intent = await resolvePincodeCoordinates(intent, this.options.pincodeResolver);

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
      interpretation: describeIntent(displayIntent),
      sources,
      usedGemini,
      messages
    };
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

  private fetchAolPage(
    intent: ResolvedSearchIntent,
    now: Date
  ): Promise<AolListingPage> {
    return fetchAolCourseListings(buildAolFilters(intent, now), {
      fetchImpl: this.options.fetchImpl,
      limit: this.options.aolListingLimit
    });
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
  intent: ResolvedSearchIntent
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
  if (intent.pincode) rows.push({ label: 'Near', value: intent.pincode });
  else if (intent.city) rows.push({ label: 'Near', value: intent.city });
  if (typeof intent.radiusKm === 'number') {
    rows.push({ label: 'Within', value: String(intent.radiusKm) + ' km' });
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
