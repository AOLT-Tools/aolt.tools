import {
  findCourseAlias,
  findCourseAliasByCode,
  findVdsEventAlias,
  type CourseAliasDefinition,
  type VdsEventAliasDefinition
} from './courseAliases.js';
import {
  detectDatePreset,
  detectNamedMonthRange,
  resolveDatePreset,
  stripMonthExpressions,
  type DatePreset,
  type DateRange
} from './dateRanges.js';
import { normalizePincode } from '@aolt/core/normalization';
import type {
  DeliveryMode,
  ResolvedSearchIntent,
  SearchConfidence,
  SearchIntent,
  SearchIntentSource
} from './searchIntent.js';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export type ParseSearchQueryOptions = {
  now?: Date;
};

const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 250;

const RADIUS_BODY =
  '(?:(?:within|under|up\\s*to)\\s+)?(\\d+(?:\\.\\d+)?)\\s*(?:kms|kilometers?|km)';

const STOPWORDS = new Set([
  'near',
  'nearby',
  'nearest',
  'closest',
  'around',
  'within',
  'under',
  'of',
  'in',
  'at',
  'for',
  'from',
  'by',
  'with',
  'km',
  'kms',
  'kilometer',
  'kilometers',
  'teacher',
  'course',
  'courses',
  'event',
  'events',
  'happening',
  'things',
  'whats',
  'what',
  'is',
  'are',
  'a',
  'an',
  'and',
  'or',
  'program',
  'programs',
  'puja',
  'pujas',
  'pooja',
  'poojas',
  'homa',
  'homas',
  'homam',
  'seva',
  'sevas',
  'kriya',
  'ashram',
  'class',
  'classes',
  'workshop',
  'find',
  'show',
  'me',
  'please',
  'online',
  'offline',
  'physical',
  'zoom',
  'home',
  'today',
  'tomorrow',
  'this',
  'next',
  'week',
  'weekend',
  'month',
  'morning',
  'afternoon',
  'evening',
  'night',
  'person'
]);

const LANGUAGE_ALIASES = new Map([
  ['english', 'English'],
  ['hindi', 'Hindi'],
  ['kannada', 'Kannada'],
  ['tamil', 'Tamil'],
  ['telugu', 'Telugu'],
  ['malayalam', 'Malayalam'],
  ['marathi', 'Marathi'],
  ['gujarati', 'Gujarati'],
  ['bengali', 'Bengali'],
  ['odia', 'Odia'],
  ['oriya', 'Odia'],
  ['punjabi', 'Punjabi']
]);

const EVENT_NAME_TOKENS = new Set([
  'rudra',
  'guru',
  'gau',
  'navratri',
  'navaratri',
  'satyanarayan',
  'pradosh'
]);

const TIME_OF_DAY_HOURS: Record<Exclude<TimeOfDay, 'night'>, [string, string]> = {
  morning: ['5', '11'],
  afternoon: ['11', '17'],
  evening: ['17', '23']
};

type TeacherMatch = {
  name: string;
  phrase: string;
};

export function clampRadiusKm(value: number): number {
  if (!Number.isFinite(value)) return MIN_RADIUS_KM;
  return Math.max(MIN_RADIUS_KM, Math.min(MAX_RADIUS_KM, value));
}

export function explicitRadiusKmFromQuery(query: string): number | null {
  const matches = [...query.matchAll(new RegExp('\\b' + RADIUS_BODY + '\\b', 'gi'))];
  const last = matches.at(-1)?.[1];
  if (!last) return null;
  const value = Number(last);
  return Number.isFinite(value) ? clampRadiusKm(value) : null;
}

export function parseSearchQuery(
  query: string,
  options: ParseSearchQueryOptions = {}
): ResolvedSearchIntent {
  const now = options.now || new Date();
  const rawQuery = query.trim();
  const normalized = rawQuery.toLowerCase();
  const alias = findCourseAlias(rawQuery);
  const eventAlias = findVdsEventAlias(rawQuery);
  const pincode = normalizePincode(rawQuery) || undefined;
  const explicitRadius = explicitRadiusKmFromQuery(rawQuery);
  const language = detectLanguage(normalized);
  const datePreset = detectDatePreset(normalized);
  const namedMonth = detectNamedMonthRange(rawQuery, now);
  const dateRange = namedMonth?.range || resolveDatePreset(datePreset, now);
  const timeOfDay = detectTimeOfDay(normalized);
  const deliveryMode = detectDeliveryMode(normalized);
  const teacher = detectTeacher(rawQuery);
  const ashramMentioned = detectAshram(normalized);
  const timeRange = timeOfDay ? TIME_OF_DAY_HOURS[timeOfDay] : undefined;
  const keywords = detectKeywords(rawQuery, {
    language,
    teacher,
    dateRange,
    datePhrase: namedMonth?.phrase,
    courseAlias: alias,
    eventAlias
  });
  const city = detectCity(rawQuery, {
    alias,
    eventAlias,
    language,
    teacher,
    dateRange,
    datePhrase: namedMonth?.phrase
  });

  const intent: ResolvedSearchIntent = {
    rawQuery,
    confidence: 'low',
    courseTypeIds: alias ? [...alias.typeIds] : [],
    ashramMentioned,
    vdsMentioned: Boolean(eventAlias) || detectVdsTerms(normalized),
    courseMentioned: Boolean(alias) || detectCourseTerms(normalized),
    pincodeResolved: false,
    messages: []
  };

  if (alias) {
    intent.courseCode = alias.code;
    intent.courseLabel = alias.label;
  }
  if (pincode) intent.pincode = pincode;
  if (city) intent.city = city;
  if (explicitRadius != null) intent.radiusKm = explicitRadius;
  if (language) intent.language = language;
  if (deliveryMode) intent.deliveryMode = deliveryMode;
  if (dateRange) {
    intent.dateFrom = dateRange.start;
    intent.dateTo = dateRange.end;
    intent.dateLabel = dateRange.label;
  }
  if (timeRange) {
    intent.startTimeFrom = timeRange[0];
    intent.startTimeTo = timeRange[1];
  }
  if (teacher?.name) intent.teacher = teacher.name;
  if (keywords.length) intent.keywords = keywords;
  if (eventAlias) intent.eventType = eventAlias.eventType;

  intent.confidence = inferConfidence(intent);
  return intent;
}

export function isDeterministicParseComplete(intent: ResolvedSearchIntent): boolean {
  if (intent.confidence === 'low') return false;
  return Boolean(
    intent.courseCode ||
    intent.pincode ||
    intent.city ||
    intent.deliveryMode ||
    intent.dateFrom ||
    intent.teacher ||
    intent.eventType ||
    intent.ashramMentioned ||
    intent.vdsMentioned ||
    intent.language ||
    intent.radiusKm ||
    intent.keywords?.length
  );
}

export function normalizeExternalIntent(
  query: string,
  value: Partial<SearchIntent> & {
    datePreset?: DatePreset;
    dateLabel?: string;
    eventType?: string;
    courseTypeIds?: string[];
  },
  options: ParseSearchQueryOptions = {}
): ResolvedSearchIntent {
  const deterministic = parseSearchQuery(query, options);
  const now = options.now || new Date();
  const explicitRadius = explicitRadiusKmFromQuery(query);
  const alias = value.courseCode ? findCourseAliasByCode(value.courseCode) : undefined;
  const source = sourceValue(value.source) || deterministic.source;
  const courseCode = alias?.code || deterministic.courseCode;
  const courseLabel = alias?.label || deterministic.courseLabel;
  const externalCity = normalizeCityCandidate(
    stripMonthExpressions(textValue(value.city))
  );
  const datePreset = datePresetValue(value.datePreset);
  const resolvedPreset = resolveDatePreset(datePreset, now);
  const dateFrom =
    dateValue(value.dateFrom) || resolvedPreset?.start || deterministic.dateFrom;
  const dateTo = dateValue(value.dateTo) || resolvedPreset?.end || deterministic.dateTo;

  return {
    ...deterministic,
    source,
    courseCode,
    courseLabel,
    courseTypeIds: alias ? [...alias.typeIds] : deterministic.courseTypeIds,
    pincode:
      normalizePincode(value.pincode || deterministic.pincode || '') || undefined,
    city: externalCity || deterministic.city,
    language: normalizeLanguage(value.language) || deterministic.language,
    radiusKm:
      explicitRadius ??
      (typeof value.radiusKm === 'number' && Number.isFinite(value.radiusKm)
        ? clampRadiusKm(value.radiusKm)
        : deterministic.radiusKm),
    deliveryMode: deliveryModeValue(value.deliveryMode) || deterministic.deliveryMode,
    dateFrom,
    dateTo,
    dateLabel:
      textValue(value.dateLabel) ||
      resolvedPreset?.label ||
      (dateFrom && dateTo ? dateFrom + ' to ' + dateTo : deterministic.dateLabel),
    startTimeFrom: textValue(value.startTimeFrom) || deterministic.startTimeFrom,
    startTimeTo: textValue(value.startTimeTo) || deterministic.startTimeTo,
    teacher: textValue(value.teacher) || deterministic.teacher,
    keywords: keywordValues(value.keywords) || deterministic.keywords,
    eventType: textValue(value.eventType) || deterministic.eventType,
    courseMentioned: Boolean(courseCode) || deterministic.courseMentioned,
    ashramMentioned: deterministic.ashramMentioned || detectAshram(query.toLowerCase()),
    vdsMentioned: deterministic.vdsMentioned || Boolean(textValue(value.eventType)),
    confidence: 'medium',
    messages: deterministic.messages
  };
}

function inferConfidence(intent: ResolvedSearchIntent): SearchConfidence {
  if (intent.courseCode && (intent.pincode || intent.city || intent.deliveryMode)) {
    return 'high';
  }
  if (intent.eventType && (intent.dateFrom || intent.city || intent.pincode)) {
    return 'high';
  }
  if (intent.ashramMentioned && (intent.courseCode || intent.teacher || intent.city)) {
    return 'high';
  }
  if (
    intent.courseCode ||
    intent.pincode ||
    intent.eventType ||
    intent.ashramMentioned
  ) {
    return 'high';
  }
  if (
    intent.city ||
    intent.language ||
    intent.deliveryMode ||
    intent.dateFrom ||
    intent.teacher ||
    intent.keywords?.length
  ) {
    return 'medium';
  }
  return 'low';
}

function detectLanguage(normalized: string): string | undefined {
  for (const [alias, label] of LANGUAGE_ALIASES.entries()) {
    if (new RegExp('\\b' + alias + '\\b', 'i').test(normalized)) {
      return label;
    }
  }
  return undefined;
}

function detectTimeOfDay(normalized: string): Exclude<TimeOfDay, 'night'> | undefined {
  if (/\bmorning\b/i.test(normalized)) return 'morning';
  if (/\bafternoon\b/i.test(normalized)) return 'afternoon';
  if (/\bevening\b/i.test(normalized)) return 'evening';
  return undefined;
}

function detectDeliveryMode(normalized: string): DeliveryMode | undefined {
  if (/\b(online|zoom|from\s+home)\b/i.test(normalized)) return 'online';
  if (/\b(offline|in\s+person|in-person|physical)\b/i.test(normalized)) {
    return 'in_person';
  }
  return undefined;
}

function detectAshram(normalized: string): boolean {
  return /\b(bangalore\s+ashram|bengaluru\s+ashram|ashram)\b/i.test(normalized);
}

function detectVdsTerms(normalized: string): boolean {
  return /\b(puja|pujas|pooja|poojas|homa|homas|homam|seva|sevas|vaidic|rudra|tarpan|archana|parayanam)\b/i.test(
    normalized
  );
}

function detectCourseTerms(normalized: string): boolean {
  return /\b(course|courses|program|programs|class|classes|workshop|happiness|intuition|sahaj|yoga|meditation)\b/i.test(
    normalized
  );
}

function detectTeacher(value: string): TeacherMatch | undefined {
  const match = value.match(
    /\b(?:by|with|teacher)\s+([A-Za-z][A-Za-z.' -]{1,80}?)(?=\s+\b(?:in|near|around|at|for|on|this|next|today|tomorrow|online|offline|within|limit|top|bangalore|bengaluru|ashram)\b|$)/i
  );
  const name = match?.[1]?.trim().replace(/\s+/g, ' ');
  return name && match?.[0] ? { name, phrase: match[0] } : undefined;
}

function detectCity(
  query: string,
  options: {
    alias?: CourseAliasDefinition;
    eventAlias?: VdsEventAliasDefinition;
    language?: string;
    teacher?: TeacherMatch;
    dateRange?: DateRange;
    datePhrase?: string;
  }
): string | undefined {
  let citySource = stripAlias(query, options.alias);
  citySource = stripEventAlias(citySource, options.eventAlias);
  citySource = stripNlpFragments(citySource, options);
  const city = normalizeCityCandidate(citySource);
  return city || undefined;
}

function detectKeywords(
  value: string,
  options: {
    language?: string;
    teacher?: TeacherMatch;
    dateRange?: DateRange;
    datePhrase?: string;
    courseAlias?: CourseAliasDefinition;
    eventAlias?: VdsEventAliasDefinition;
  }
): string[] {
  let next = stripAlias(value, options.courseAlias);
  next = stripEventAlias(next, options.eventAlias);
  next = stripNlpFragments(next, options);
  next = stripRadiusExpressions(stripMonthExpressions(next))
    .replace(/\b[1-9]\d{5}\b/g, ' ')
    .replace(/\blimit\s+\d+\b/gi, ' ')
    .replace(/\btop\s+\d+\b/gi, ' ');

  const tokens = next
    .toLowerCase()
    .replace(/[^a-z0-9.' -]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length > 1 && !STOPWORDS.has(token) && !LANGUAGE_ALIASES.has(token)
    );
  if (options.teacher?.name) tokens.push(options.teacher.name.toLowerCase());
  for (const name of EVENT_NAME_TOKENS) {
    if (new RegExp('\\b' + name + '\\b', 'i').test(value)) tokens.unshift(name);
  }
  return [...new Set(tokens)].slice(0, 8);
}

function stripRadiusExpressions(value: string): string {
  return value.replace(new RegExp('\\b' + RADIUS_BODY + '\\b', 'gi'), ' ');
}

function removeKeyword(value: string, keyword: string): string {
  return value.replace(new RegExp('\\b' + escapeRegExp(keyword) + '\\b', 'gi'), ' ');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripAlias(value: string, alias: CourseAliasDefinition | undefined): string {
  if (!alias) return value;
  return [...alias.keywords]
    .sort((left, right) => right.length - left.length)
    .reduce((next, keyword) => removeKeyword(next, keyword), value);
}

function stripEventAlias(
  value: string,
  alias: VdsEventAliasDefinition | undefined
): string {
  if (!alias) return value;
  return [...alias.keywords]
    .sort((left, right) => right.length - left.length)
    .reduce((next, keyword) => removeKeyword(next, keyword), value);
}

function stripNlpFragments(
  value: string,
  options: {
    language?: string;
    teacher?: TeacherMatch;
    dateRange?: DateRange;
    datePhrase?: string;
  }
): string {
  let next = value;
  if (options.teacher)
    next = next.replace(new RegExp(escapeRegExp(options.teacher.phrase), 'ig'), ' ');
  if (options.language) next = removeKeyword(next, options.language);
  if (options.datePhrase) next = next.replace(options.datePhrase, ' ');
  return next
    .replace(
      /\b(today|tomorrow|this\s+week|this\s+weekend|next\s+week|next\s+weekend)\b/gi,
      ' '
    )
    .replace(/\b(this|next)\s+month\b/gi, ' ')
    .replace(/\b(morning|afternoon|evening|night)\b/gi, ' ')
    .replace(
      /\b(online|zoom|from\s+home|offline|in\s+person|in-person|physical)\b/gi,
      ' '
    )
    .replace(/\b(nearest|closest|nearby)\b/gi, ' ')
    .replace(/\bbangalore\s+ashram\b/gi, ' ')
    .replace(/\bbengaluru\s+ashram\b/gi, ' ');
}

function normalizeCityCandidate(value: string): string {
  return stripRadiusExpressions(value)
    .replace(/\b[1-9]\d{5}\b/g, ' ')
    .replace(/[^a-zA-Z\s.'-]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token &&
        !STOPWORDS.has(token.toLowerCase()) &&
        !EVENT_NAME_TOKENS.has(token.toLowerCase())
    )
    .join(' ')
    .trim();
}

function normalizeLanguage(value: unknown): string {
  const raw = textValue(value);
  if (!raw) return '';
  return LANGUAGE_ALIASES.get(raw.toLowerCase()) || raw;
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function dateValue(value: unknown): string | undefined {
  const raw = textValue(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}

function keywordValues(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value
    .map(textValue)
    .map((item) => item.toLowerCase())
    .filter(
      (item) =>
        item.length > 1 &&
        item.length <= 80 &&
        !STOPWORDS.has(item) &&
        !/^\d+(?:\.\d+)?(?:kms|kilometers?|km)$/i.test(item)
    );
  return values.length ? [...new Set(values)].slice(0, 8) : undefined;
}

function datePresetValue(value: unknown): DatePreset | undefined {
  return value === 'today' ||
    value === 'tomorrow' ||
    value === 'this_week' ||
    value === 'this_weekend' ||
    value === 'next_week' ||
    value === 'next_weekend'
    ? value
    : undefined;
}

function deliveryModeValue(value: unknown): DeliveryMode | undefined {
  if (value === 'offline') return 'in_person';
  return value === 'online' || value === 'in_person' || value === 'any'
    ? value
    : undefined;
}

function sourceValue(value: unknown): SearchIntentSource | undefined {
  return value === 'aol' || value === 'vvmvp' || value === 'vds' || value === 'all'
    ? value
    : undefined;
}
