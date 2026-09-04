export type MatchableCourse = {
  isActive: boolean;
  courseType: string;
};

export function normalizeCourseCode(value: string): string {
  return String(value || '')
    .trim()
    .toUpperCase();
}

export function findUniqueActiveCourse<T extends MatchableCourse>(
  wishlistPrograms: readonly string[],
  courses: readonly T[]
): T | null {
  const wanted = new Set(wishlistPrograms.map(normalizeCourseCode).filter(Boolean));
  if (!wanted.size) {
    return null;
  }

  const matches = courses.filter(
    (course) =>
      course.isActive &&
      Boolean(normalizeCourseCode(course.courseType)) &&
      wanted.has(normalizeCourseCode(course.courseType))
  );
  return matches.length === 1 ? matches[0] : null;
}

export function fillCourseWhatsappTemplate(
  template: string,
  values: {
    name: string;
    course: string;
    dates: string;
    registrationLink: string;
  }
): string {
  return String(template || '')
    .replaceAll('{name}', values.name || 'Friend')
    .replaceAll('{course}', values.course || '')
    .replaceAll('{dates}', values.dates || '')
    .replaceAll('{registrationLink}', values.registrationLink || '')
    .replaceAll('{courseUrl}', '');
}
