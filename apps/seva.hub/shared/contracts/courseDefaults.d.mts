export const DEFAULT_CENTER_WHATSAPP_NUMBER: string;
export const IP_COURSE_PROGRAMS: readonly {
  readonly code: string;
  readonly label: string;
}[];

export function normalizeActivityType(value?: string): 'Course' | 'Event';
export function activityAudience(activityType?: string): 'Leads' | 'Members';
export function isEventActivity(activity?: { activityType?: string }): boolean;
export function isCourseActivity(activity?: { activityType?: string }): boolean;
export function normalizeCourseType(value: string): string;
export function isIpCourseType(courseType: string): boolean;
export function programsForCourseType(
  courseType: string
): Array<{ code: string; label: string }>;
export function normalizeProgramCode(courseType: string, programCode?: string): string;
export function programLabelFor(courseType: string, programCode?: string): string;
export function courseSlotKey(courseType: string, programCode?: string): string;
export function formatCourseTitle(courseType: string, programCode?: string): string;
export function formatActivityTitle(activity?: {
  activityType?: string;
  title?: string;
  courseType?: string;
  programCode?: string;
}): string;
export function publicCourseProgramKey(
  courseType: string,
  programCode?: string
): string;
export function publicCoursesPath(programKey?: string): string;
export function selectActivePublicCourses<
  T extends {
    activityType?: string;
    courseType?: string;
    programCode?: string;
    isActive?: boolean;
  }
>(
  courses: T[],
  programKey?: string
): { selected: T | null; courses: T[]; selectionMatched: boolean };
export const HOMEPAGE_PROGRAM_OFFERS: readonly {
  readonly code: string;
  readonly label: string;
}[];
export function homepageProgramOffers(
  courses: Array<{
    activityType?: string;
    courseType?: string;
    isActive?: boolean;
    programCode?: string;
  }>
): Array<{
  code: string;
  label: string;
  active: boolean;
  registerPath: string;
}>;
