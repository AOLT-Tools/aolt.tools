import { COURSE_ALIASES, findCourseAliasByCode } from './courseAliases.js';

export type CourseCategoryId =
  | 'beginner'
  | 'kids'
  | 'yoga'
  | 'advanced'
  | 'follow_up'
  | 'other';

export type CourseFilterId = CourseCategoryId;

export const COURSE_CATEGORY_ORDER: readonly CourseCategoryId[] = [
  'beginner',
  'kids',
  'yoga',
  'advanced',
  'follow_up',
  'other'
];

export const COURSE_FILTER_ORDER: readonly CourseFilterId[] = COURSE_CATEGORY_ORDER;

export const COURSE_CATEGORY_LABELS: Record<CourseFilterId, string> = {
  beginner: 'Beginner',
  kids: 'Kids',
  yoga: 'Yoga',
  advanced: 'Advanced',
  follow_up: 'Follow-up',
  other: 'Other'
};

export const AOL_RADIUS_LADDER_KM = [3, 10, 25, 50] as const;

const KIDS_TITLE = /\b(kids?|junior|teens?|child(?:ren)?)\b/i;
const SAHAJ_TITLE = /sahaj\s+samadhi/i;

const CATEGORY_BY_CODE: Record<string, CourseCategoryId> = {
  HP: 'beginner',
  MEDHA: 'kids',
  UTKARSHA: 'kids',
  IP: 'other',
  SSY: 'yoga',
  SSDY: 'beginner',
  AMP: 'advanced',
  DSN: 'advanced',
  SANYAM: 'advanced',
  VTP: 'advanced',
  FOLLOW_UP: 'follow_up'
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
  return COURSE_CATEGORY_ORDER.includes(value as CourseCategoryId)
    ? (value as CourseCategoryId)
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

export function categorizeCourse(input: {
  title?: string;
  courseCode?: string;
  courseTypeId?: string;
}): CourseCategoryId {
  const title = input.title || '';
  const code = resolveCourseCode(input.courseCode, input.courseTypeId);
  if (code === 'SSDY' || SAHAJ_TITLE.test(title)) return 'beginner';
  if (code === 'IP' && KIDS_TITLE.test(title)) return 'kids';
  if (code && CATEGORY_BY_CODE[code]) return CATEGORY_BY_CODE[code];
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
