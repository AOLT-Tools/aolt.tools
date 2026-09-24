import { COURSE_ALIASES, findCourseAliasByCode } from './courseAliases.js';

export type CourseCategoryId =
  | 'beginner'
  | 'kids'
  | 'yoga'
  | 'advanced'
  | 'regular_connects'
  | 'other';

export type CourseFilterId = CourseCategoryId;

export const COURSE_CATEGORY_ORDER: readonly CourseCategoryId[] = [
  'beginner',
  'kids',
  'yoga',
  'advanced',
  'regular_connects',
  'other'
];

export const COURSE_FILTER_ORDER: readonly CourseFilterId[] = COURSE_CATEGORY_ORDER;

export const COURSE_CATEGORY_LABELS: Record<CourseFilterId, string> = {
  beginner: 'Beginner',
  kids: 'Kids',
  yoga: 'Yoga',
  advanced: 'Advanced',
  regular_connects: 'Regular Connects',
  other: 'Other'
};

export const AOL_RADIUS_LADDER_KM = [3, 10, 25, 50] as const;

const KIDS_TITLE = /\b(kids?|junior|teens?|child(?:ren)?)\b/i;
const IP2_TITLE = /\b(?:ip\s*2|intuition\s+process\s*2|intuition\s+program\s*2)\b/i;
const SAHAJ_TITLE = /sahaj\s+samadhi/i;
const SATSANG_TITLE = /\bsatsangs?\b/i;

const CATEGORY_BY_CODE: Record<string, CourseCategoryId> = {
  HP: 'beginner',
  OMBW: 'beginner',
  MEDHA: 'kids',
  UTKARSHA: 'kids',
  IP2: 'kids',
  IP: 'other',
  SSY: 'yoga',
  SSY_DEEP_DIVE: 'yoga',
  SSDY: 'beginner',
  SPEED_READING: 'other',
  DEEP_SLEEP: 'other',
  AMP: 'advanced',
  DSN: 'advanced',
  SANYAM: 'advanced',
  VTP: 'advanced',
  FOLLOW_UP: 'regular_connects'
};

const TYPE_ID_TO_CODE = new Map<string, string>();
for (const alias of COURSE_ALIASES) {
  for (const typeId of alias.typeIds) {
    TYPE_ID_TO_CODE.set(typeId, alias.code);
  }
}

export function courseCategoryLabel(id: CourseFilterId): string {
  return COURSE_CATEGORY_LABELS[id];
}

export function parseCourseFilter(value: string | undefined): CourseFilterId | undefined {
  const id = value === 'follow_up' ? 'regular_connects' : value;
  return COURSE_CATEGORY_ORDER.includes(id as CourseCategoryId)
    ? (id as CourseCategoryId)
    : undefined;
}

export function parseCourseCategories(value: string | undefined): CourseCategoryId[] {
  if (!value) return [];
  const seen = new Set<CourseCategoryId>();
  for (const part of value.split(',')) {
    const id = parseCourseFilter(part.trim());
    if (id) seen.add(id);
  }
  return COURSE_CATEGORY_ORDER.filter((id) => seen.has(id));
}

export function resolveCourseCategory(
  present: readonly CourseCategoryId[],
  selected: Iterable<CourseCategoryId>
): CourseCategoryId | undefined {
  if (!present.length) return undefined;
  const chosen = new Set(selected);
  const kept = COURSE_CATEGORY_ORDER.find(
    (id) => chosen.has(id) && present.includes(id)
  );
  if (kept) return kept;
  if (present.includes('beginner')) return 'beginner';
  return present[0];
}

export function serializeCourseCategories(ids: Iterable<CourseCategoryId>): string {
  const seen = new Set(ids);
  return COURSE_CATEGORY_ORDER.filter((id) => seen.has(id)).join(',');
}

export function presentCourseCategories(
  listings: Array<{ category?: string }>
): CourseCategoryId[] {
  const present = new Set<CourseCategoryId>();
  for (const listing of listings) {
    present.add(parseCourseFilter(listing.category) || 'other');
  }
  return COURSE_CATEGORY_ORDER.filter((id) => present.has(id));
}

export function nextAolRadiusKm(currentKm: number): number | undefined {
  return AOL_RADIUS_LADDER_KM.find((radius) => radius > currentKm);
}

const KIDS_CATALOG_CODES = new Set(['IP', 'IP2', 'MEDHA', 'UTKARSHA']);

export function inPersonCatalogTypeGroups(): string[][] {
  const grouped = new Map<CourseCategoryId, Set<string>>();
  for (const alias of COURSE_ALIASES) {
    if (alias.code === 'FOLLOW_UP' || alias.typeIds.length === 0) continue;
    const category = KIDS_CATALOG_CODES.has(alias.code)
      ? 'kids'
      : CATEGORY_BY_CODE[alias.code] || 'other';
    if (category === 'regular_connects') continue;
    const bucket = grouped.get(category) || new Set<string>();
    for (const typeId of alias.typeIds) bucket.add(typeId);
    grouped.set(category, bucket);
  }
  return COURSE_CATEGORY_ORDER.flatMap((category) => {
    const ids = grouped.get(category);
    return ids?.size ? [[...ids]] : [];
  });
}

export function isRegularConnectListing(input: {
  title?: string;
  courseCode?: string;
  courseTypeId?: string;
  category?: string;
}): boolean {
  if (input.category) return input.category === 'regular_connects';
  return categorizeCourse(input) === 'regular_connects';
}

export function categorizeCourse(input: {
  title?: string;
  courseCode?: string;
  courseTypeId?: string;
}): CourseCategoryId {
  const title = input.title || '';
  const code = resolveCourseCode(input.courseCode, input.courseTypeId);
  if (code === 'SSDY' || SAHAJ_TITLE.test(title)) return 'beginner';
  if (code === 'IP2' || IP2_TITLE.test(title)) return 'kids';
  if (code === 'IP' && KIDS_TITLE.test(title)) return 'kids';
  if (code && CATEGORY_BY_CODE[code]) return CATEGORY_BY_CODE[code];
  if (SATSANG_TITLE.test(title)) return 'regular_connects';
  if (KIDS_TITLE.test(title)) return 'kids';
  return 'other';
}

function resolveCourseCode(
  courseCode?: string,
  courseTypeId?: string
): string | undefined {
  if (courseCode && findCourseAliasByCode(courseCode)) {
    return courseCode.trim().toUpperCase();
  }
  const typeId = courseTypeId?.trim();
  return typeId ? TYPE_ID_TO_CODE.get(typeId) : undefined;
}
