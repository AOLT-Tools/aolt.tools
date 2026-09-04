export const DEFAULT_CENTER_WHATSAPP_NUMBER = '918884560660';

export const IP_COURSE_PROGRAMS = Object.freeze([
  Object.freeze({ code: 'j', label: 'Junior' }),
  Object.freeze({ code: 's', label: 'Senior' })
]);

export function normalizeActivityType(value) {
  return String(value || '')
    .trim()
    .toLowerCase() === 'event'
    ? 'Event'
    : 'Course';
}

export function activityAudience(activityType) {
  return normalizeActivityType(activityType) === 'Event' ? 'Members' : 'Leads';
}

export function isEventActivity(activity) {
  return normalizeActivityType(activity?.activityType) === 'Event';
}

export function isCourseActivity(activity) {
  return normalizeActivityType(activity?.activityType) === 'Course';
}

export function normalizeCourseType(value) {
  return String(value || '').trim();
}

export function isIpCourseType(courseType) {
  return normalizeCourseType(courseType).toUpperCase() === 'IP';
}

export function programsForCourseType(courseType) {
  return isIpCourseType(courseType) ? [...IP_COURSE_PROGRAMS] : [];
}

export function normalizeProgramCode(courseType, programCode) {
  const programs = programsForCourseType(courseType);
  if (!programs.length) {
    return '';
  }
  const code = String(programCode || '')
    .trim()
    .toLowerCase();
  return programs.some((item) => item.code === code) ? code : '';
}

export function programLabelFor(courseType, programCode) {
  const code = normalizeProgramCode(courseType, programCode);
  const match = programsForCourseType(courseType).find((item) => item.code === code);
  return match ? match.label : '';
}

export function courseSlotKey(courseType, programCode) {
  return (
    normalizeCourseType(courseType).toUpperCase() +
    ':' +
    normalizeProgramCode(courseType, programCode)
  );
}

export function formatCourseTitle(courseType, programCode) {
  const type = normalizeCourseType(courseType) || 'Course';
  const label = programLabelFor(courseType, programCode);
  return label ? type + ' ' + label : type;
}

export function formatActivityTitle(activity) {
  if (isEventActivity(activity)) {
    return String(activity?.title || '').trim() || 'Event';
  }
  return formatCourseTitle(activity?.courseType, activity?.programCode);
}

export function publicCourseProgramKey(courseType, programCode) {
  const type = normalizeCourseType(courseType)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (!type) {
    return '';
  }
  const code = normalizeProgramCode(courseType, programCode);
  return code ? type + '-' + code : type;
}

export function publicCoursesPath(programKey) {
  const key = String(programKey || '')
    .trim()
    .toLowerCase();
  return key ? '/courses?program=' + encodeURIComponent(key) : '/courses';
}

export function selectActivePublicCourses(courses, programKey) {
  const activeCourses = (Array.isArray(courses) ? courses : []).filter(
    (course) => Boolean(course && course.isActive) && isCourseActivity(course)
  );
  const wanted = String(programKey || '')
    .trim()
    .toLowerCase();
  const matched = wanted
    ? activeCourses.find(
        (course) =>
          publicCourseProgramKey(course.courseType, course.programCode) === wanted
      ) ||
      activeCourses.find(
        (course) => publicCourseProgramKey(course.courseType) === wanted
      )
    : null;
  return {
    selected: matched || activeCourses[0] || null,
    courses: activeCourses,
    selectionMatched: Boolean(matched)
  };
}

export const HOMEPAGE_PROGRAM_OFFERS = Object.freeze([
  Object.freeze({
    code: 'HP',
    label: 'Happiness Program'
  }),
  Object.freeze({
    code: 'IP',
    label: 'Intuition Program'
  }),
  Object.freeze({
    code: 'Sahaj',
    label: 'Sahaj Samadhi Meditation'
  })
]);

export function homepageProgramOffers(courses) {
  const list = Array.isArray(courses) ? courses : [];
  return HOMEPAGE_PROGRAM_OFFERS.map((offer) => {
    const programKey = publicCourseProgramKey(offer.code);
    const active = list.some(
      (course) =>
        Boolean(course && course.isActive) &&
        isCourseActivity(course) &&
        publicCourseProgramKey(course.courseType) === programKey
    );
    return {
      code: offer.code,
      label: offer.label,
      active,
      registerPath: publicCoursesPath(programKey)
    };
  });
}
