import type { Course, CourseTemplate } from '../../../shared/contracts/appContracts';
import type { Lead, SevaWorkspaceContext } from '../seva/types';
import {
  activityAudience,
  formatCourseTitle,
  isCourseActivity,
  isEventActivity,
  isIpCourseType,
  normalizeCourseType,
  programsForCourseType
} from '../../../shared/contracts/courseDefaults.mjs';

export function matchingCoursesForLead(
  lead: Lead | null | undefined,
  active: readonly Course[]
): Course[] {
  if (lead?.campaignType === 'Members') {
    return active.filter((course: Course) => isEventActivity(course));
  }

  const programs = (lead?.wishlistPrograms || [])
    .map((item) =>
      String(item || '')
        .trim()
        .toUpperCase()
    )
    .filter(Boolean);
  if (!programs.length) {
    return [...active];
  }
  return active.filter((course: Course) =>
    programs.includes(normalizeCourseType(course.courseType).toUpperCase())
  );
}

export function activeCoursesForContext(
  context: SevaWorkspaceContext,
  lead?: Lead | null
): Course[] {
  const audience = lead?.campaignType || context.campaignType;
  return context.courses.filter(
    (course) => course.isActive && activityAudience(course.activityType) === audience
  );
}

export function coursePickerOptionsForContext(context: SevaWorkspaceContext): Course[] {
  const active = activeCoursesForContext(context, context.coursePickerLead);
  const matching = matchingCoursesForLead(context.coursePickerLead, active);
  if (context.coursePickerMode === 'imageShare') {
    return matching.filter((course: Course) => course.hasImage);
  }
  return matching.length ? matching : active;
}

export function coursePickerTitle(mode: string): string {
  return mode === 'imageShare' ? 'Share which image?' : 'Select activity';
}

export function courseImageUrl(course: Course): string {
  if (!course.id || !course.hasImage) {
    return '';
  }
  const stored = String(course.imageUrl || '').trim();
  return /^https:\/\//i.test(stored) || /^data:image\//i.test(stored) ? stored : '';
}

function imageExtension(imageUrl: string): string {
  const normalized = imageUrl.toLowerCase().split('?')[0] || '';
  if (normalized.endsWith('.png')) {
    return 'png';
  }
  if (normalized.endsWith('.webp')) {
    return 'webp';
  }
  return 'jpg';
}

function fileSafeName(value: string): string {
  return (
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'activity-image'
  );
}

export function courseImageDownloadName(
  displayTitle: string,
  imageUrl: string
): string {
  return 'seva-hub-' + fileSafeName(displayTitle) + '.' + imageExtension(imageUrl);
}

export function ipPrograms() {
  return programsForCourseType('IP');
}

export function isCourseDraftEvent(context: SevaWorkspaceContext): boolean {
  return context.courseDraft.activityType === 'Event';
}

export function showsProgramTabs(context: SevaWorkspaceContext): boolean {
  return (
    context.courseDraft.activityType === 'Course' &&
    isIpCourseType(context.courseDraft.courseType)
  );
}

export function courseDisplayTitle(
  context: SevaWorkspaceContext,
  course: Course
): string {
  if (isEventActivity(course)) {
    return course.title || 'Event';
  }
  if (isIpCourseType(course.courseType)) {
    return formatCourseTitle(course.courseType, course.programCode);
  }
  const programs =
    context.appConfig.programs.length > 0
      ? context.appConfig.programs
      : context.defaultPrograms;
  return (
    programs.find((item) => item.code === course.courseType)?.label || course.courseType
  );
}

export function coursePickerSubtitle(
  context: SevaWorkspaceContext,
  course: Course
): string {
  if (isEventActivity(course)) {
    return 'Event';
  }
  const displayTitle = courseDisplayTitle(context, course);
  const title = String(course.title || '').trim();
  return title && title !== displayTitle ? title : '';
}

export function courseCardSubtitle(course: Course): string {
  return isEventActivity(course)
    ? 'Event · Members'
    : (course.courseType || 'Course') + ' · Leads';
}

export function canOpenPublicCoursePage(course: Course): boolean {
  return isCourseActivity(course);
}

export function templateFromList(
  courseType: string,
  programCode: string,
  templates: readonly CourseTemplate[],
  fallback: (courseType: string, programCode?: string) => string
): string {
  const type = normalizeCourseType(courseType);
  const code =
    programsForCourseType(courseType).find(
      (program) =>
        program.code ===
        String(programCode || '')
          .trim()
          .toLowerCase()
    )?.code || '';
  const keys = code ? [type + '-' + code, type] : [type];
  for (const key of keys) {
    const match = templates.find(
      (item) => item.courseType.trim().toUpperCase() === key.trim().toUpperCase()
    );
    if (match?.template) {
      return match.template;
    }
  }
  return fallback(courseType, programCode);
}
