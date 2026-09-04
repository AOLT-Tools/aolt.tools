import { COURSE_ALIASES } from '../lib/courseAliases.js';

const PIN_EXAMPLES = ['560045', '560001', '560077', '110049', '600041'] as const;
const DISTANCE_KM = [5, 10, 25] as const;

const STATIC_EXAMPLES = [
  'HP near 560045 within 5km',
  'HP near 560045 within 10km',
  'HP near 560045 within 25km',
  'AMP Bangalore Ashram next weekend',
  'Rudra Puja this weekend',
  'Intuition near 560001',
  'HP online',
  'HP 560045 Hindi'
] as const;

export function getSearchSuggestions(
  value: string,
  options: { limit?: number } = {}
): string[] {
  const normalized = normalizeSearchSuggestion(value);
  if (!normalized) return [];

  const pin = typedPincode(value);
  const candidates = [
    ...pinDistanceSuggestions(value, pin),
    ...buildTeacherSuggestionCandidates(value, pin),
    ...buildSuggestionCandidates(pin),
    ...STATIC_EXAMPLES
  ];

  return uniqueByNormalized(candidates)
    .map((suggestion, index) => ({
      suggestion,
      index,
      rank: suggestionRank(suggestion, normalized)
    }))
    .filter((item) => item.rank < Number.POSITIVE_INFINITY)
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        left.index - right.index ||
        left.suggestion.length - right.suggestion.length
    )
    .map((item) => item.suggestion)
    .filter((suggestion) => normalizeSearchSuggestion(suggestion) !== normalized)
    .slice(0, options.limit || 6);
}

export function normalizeSearchSuggestion(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function pinDistanceSuggestions(value: string, pin: string): string[] {
  const trimmed = value.trim();
  if (!pin) return [];
  const prefix = trimmed.replace(/\s+within\s+\d*\s*k?m?s?$/i, '').trim();
  const base = /\bnear\b/i.test(prefix)
    ? prefix.replace(/\s+/g, ' ')
    : prefix.replace(pin, 'near ' + pin).replace(/\s+/g, ' ');
  if (!/\b[1-9]\d{5}\b/.test(base)) return [];
  return DISTANCE_KM.map((km) => base + ' within ' + String(km) + 'km');
}

function buildTeacherSuggestionCandidates(value: string, pin: string): string[] {
  const prefix = teacherQueryPrefix(value);
  if (!prefix) return [];
  const base = withNearPin(prefix, pin);
  const suggestions = [base];
  for (const km of DISTANCE_KM) {
    suggestions.push(base + ' within ' + String(km) + 'km');
  }
  if (/\b(?:teacher|with|by)\s+\S+/i.test(prefix) && !/\bashram\b/i.test(prefix)) {
    suggestions.push(prefix + ' Bangalore Ashram');
  }
  return suggestions;
}

function teacherQueryPrefix(value: string): string | undefined {
  const prefix = value
    .trim()
    .replace(/\s+within\s+\d*\s*k?m?s?$/i, '')
    .trim();
  const normalized = normalizeSearchSuggestion(prefix);
  if (
    !normalized ||
    (!/\bteachers?\b/.test(normalized) &&
      !/\bwith\b/.test(normalized) &&
      !/\bby\b/.test(normalized))
  ) {
    return undefined;
  }
  return prefix.replace(/\s+/g, ' ');
}

function withNearPin(prefix: string, pin: string): string {
  if (/\b[1-9]\d{5}\b/.test(prefix)) {
    return /\bnear\b/i.test(prefix)
      ? prefix
      : prefix.replace(/\b[1-9]\d{5}\b/, 'near $&').replace(/\s+/g, ' ');
  }
  if (/\bnear\b/i.test(prefix)) return prefix + ' ' + pin;
  return prefix + ' near ' + pin;
}

function buildSuggestionCandidates(pin: string): string[] {
  const suggestions: string[] = [];
  for (const alias of COURSE_ALIASES) {
    if (alias.code === 'FOLLOW_UP') continue;
    for (const base of [alias.code, alias.label]) {
      suggestions.push(base + ' near ' + pin);
      suggestions.push(base + ' near ' + pin + ' within 10km');
      suggestions.push(base + ' online');
    }
  }
  suggestions.push('AMP Bangalore Ashram next weekend');
  suggestions.push('Rudra Puja this weekend');
  suggestions.push('Rudra Puja next week');
  suggestions.push('Intuition near ' + pin);
  return suggestions;
}

function typedPincode(value: string): string {
  return value.match(/\b[1-9]\d{5}\b/)?.[0] || pinFromPrefix(value) || PIN_EXAMPLES[0];
}

function pinFromPrefix(value: string): string {
  const digits = value.match(/\b[1-9]\d{0,5}\b/g)?.at(-1) || '';
  if (digits.length === 6) return digits;
  if (!digits) return '';
  return PIN_EXAMPLES.find((pin) => pin.startsWith(digits)) || '';
}

function suggestionRank(suggestion: string, normalizedQuery: string): number {
  const candidate = normalizeSearchSuggestion(suggestion);
  const words = normalizedQuery.split(' ').filter(Boolean);
  let rank = Number.POSITIVE_INFINITY;
  if (candidate.startsWith(normalizedQuery)) rank = 0;
  else if (
    words.every((word) => candidate.split(' ').some((part) => part.startsWith(word)))
  ) {
    rank = 1;
  } else if (words.every((word) => candidate.includes(word))) rank = 2;
  if (rank === Number.POSITIVE_INFINITY) return rank;
  if (isDistanceSuggestion(candidate) && queryWantsDistance(normalizedQuery)) {
    return rank - 0.5;
  }
  return rank;
}

function isDistanceSuggestion(normalizedSuggestion: string): boolean {
  return /\bwithin \d+km\b/.test(normalizedSuggestion);
}

function queryWantsDistance(normalizedQuery: string): boolean {
  return (
    /\bnear\b/.test(normalizedQuery) ||
    /\bwithin\b/.test(normalizedQuery) ||
    /\b\d{6}\b/.test(normalizedQuery)
  );
}

function uniqueByNormalized(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalizeSearchSuggestion(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
