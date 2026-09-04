import { findCourseAliasByCode } from '../courseAliases.js';
import {
  currentDayTimeFrom,
  todayInIndia,
  yearFromNow
} from '../dateRanges.js';
import type {
  ResolvedSearchIntent,
  SearchSourceAdapter,
  SourceSearchResult
} from '../searchIntent.js';

export const AOL_COURSE_SEARCH_URL =
  'https://www.artofliving.org/in-en/search/course';

export const aolSearchAdapter: SearchSourceAdapter = {
  id: 'aol',
  label: 'Art of Living Courses',

  supports(intent) {
    if (intent.source === 'vvmvp' || intent.source === 'vds') return false;
    if (intent.vdsMentioned && !intent.courseMentioned && !intent.courseCode) {
      return false;
    }
    return true;
  },

  buildResult(intent, now) {
    const filters = buildAolFilters(intent, now);
    const unsupported = unsupportedAolFilters(intent);
    return {
      source: 'aol',
      label: 'Art of Living Courses',
      url: buildAolSearchUrl(filters),
      filters: visibleAolFilters(intent, filters),
      confidence: aolConfidence(intent),
      embeddable: true,
      reason: aolReason(intent),
      unsupportedFilters: unsupported
    };
  }
};

export function buildAolSearchUrl(
  filters: Record<string, string>
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === '') continue;
    params.set(key, value);
  }
  return AOL_COURSE_SEARCH_URL + '#' + params.toString();
}

const COURSE_LANGUAGE_CODES: Record<string, string> = {
  assamese: 'as',
  bengali: 'bn',
  english: 'en',
  gujarati: 'gu',
  hindi: 'hi',
  kannada: 'kn',
  kashmiri: 'ks',
  malayalam: 'ml',
  marathi: 'mr',
  nepali: 'ne',
  odia: 'or',
  oriya: 'or',
  punjabi: 'pa',
  sanskrit: 'sa',
  sindhi: 'sd',
  tamil: 'ta',
  telugu: 'te',
  urdu: 'ur',
  konkani: 'kok',
  maithili: 'mai'
};

export function aolCourseLanguage(language?: string): string {
  if (!language) return '';
  const normalized = language.trim().toLowerCase();
  if (/^[a-z]{2,3}$/.test(normalized)) return normalized;
  return COURSE_LANGUAGE_CODES[normalized] || '';
}

export function buildAolFilters(
  intent: ResolvedSearchIntent,
  now = new Date()
): Record<string, string> {
  const today = todayInIndia(now);
  const dateFrom = intent.dateFrom || today;
  const dateTo = intent.dateTo || yearFromNow(now);
  const online = intent.deliveryMode === 'online';
  const inPerson = intent.deliveryMode === 'in_person';
  const hasCoordinates =
    typeof intent.latitude === 'number' && typeof intent.longitude === 'number';

  const filters: Record<string, string> = {
    type: hasCoordinates ? 'search' : 'country',
    country: 'in',
    has_voucher: '0',
    start_date_from: dateFrom,
    start_date_to: dateTo
  };

  const ctype = (intent.courseTypeIds || []).join(',');
  if (ctype) filters.ctype = ctype;
  if (online) {
    filters.is_online_event = '1';
    filters.mode = 'Online';
  } else if (inPerson) {
    filters.is_online_event = '0';
    filters.mode = 'In Person';
  }

  const language = aolCourseLanguage(intent.language);
  if (language) filters.course_language = language;
  if (intent.startTimeFrom) filters.start_time_from = intent.startTimeFrom;
  if (intent.startTimeTo) filters.start_time_to = intent.startTimeTo;

  if (hasCoordinates) {
    filters.lat = String(intent.latitude);
    filters.lng = String(intent.longitude);
  }
  if (typeof intent.radiusKm === 'number') {
    filters.distance = String(Math.round(intent.radiusKm));
  }
  if (dateFrom === today && !intent.startTimeFrom && !intent.startTimeTo) {
    filters.current_day_time_from = currentDayTimeFrom(now);
  }

  const locationName = intent.pincode || intent.city;
  if (locationName) filters.selectedLocName = locationName;

  return filters;
}

function visibleAolFilters(
  intent: ResolvedSearchIntent,
  filters: Record<string, string>
): Record<string, string> {
  const visible: Record<string, string> = {};
  const alias = intent.courseCode
    ? findCourseAliasByCode(intent.courseCode)
    : undefined;
  if (alias) visible.course = alias.label;
  else if (filters.ctype) visible.ctype = filters.ctype;
  if (intent.teacher) visible.teacher = intent.teacher;
  if (intent.pincode) visible.pincode = intent.pincode;
  if (intent.city && !intent.pincode) visible.city = intent.city;
  if (filters.distance) visible.distance = filters.distance + ' km';
  if (intent.language) visible.language = intent.language;
  if (intent.dateLabel) visible.dates = intent.dateLabel;
  else if (intent.dateFrom && intent.dateTo) {
    visible.dates = intent.dateFrom + ' to ' + intent.dateTo;
  }
  if (filters.mode) visible.mode = filters.mode;
  if (filters.lat) visible.lat = filters.lat;
  if (filters.lng) visible.lng = filters.lng;
  return visible;
}

function unsupportedAolFilters(intent: ResolvedSearchIntent): string[] {
  const unsupported: string[] = [];
  if (intent.teacher) unsupported.push('Teacher name (official search needs teacher_id)');
  if (intent.pincode && !intent.pincodeResolved) {
    unsupported.push('PIN coordinates could not be resolved');
  }
  return unsupported;
}

function aolConfidence(intent: ResolvedSearchIntent): number {
  if (intent.courseCode && (intent.pincode || intent.city)) return 0.95;
  if (intent.courseCode) return 0.85;
  if (intent.pincode || intent.city) return 0.7;
  return 0.55;
}

function aolReason(intent: ResolvedSearchIntent): string {
  if (intent.teacher && intent.courseCode === 'FOLLOW_UP') {
    return (
      intent.teacher +
      ' is first searched as Follow Up on the official Art of Living course page.'
    );
  }
  if (intent.courseCode) {
    return (
      (intent.courseLabel || intent.courseCode) +
      ' is searched on the official Art of Living course page.'
    );
  }
  return 'Art of Living course search is the primary public catalog for programs in India.';
}
