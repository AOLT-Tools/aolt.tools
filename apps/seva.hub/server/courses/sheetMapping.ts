import {
  CourseSchema,
  type Course,
  type CreateCourseRequest,
  type UpdateCourseRequest
} from '../../shared/contracts/appContracts.js';
import { isHttpsUrl } from './images.js';
import {
  activityAudience,
  courseSlotKey,
  formatActivityTitle,
  formatCourseTitle,
  isCourseActivity,
  normalizeProgramCode,
  normalizeActivityType
} from '../../shared/contracts/courseDefaults.mjs';
import { templateForActivity } from '../../shared/contracts/courseTemplates.mjs';
import { SHEET_HEADERS } from '../../shared/contracts/sheetContract.mjs';
import { findHeaderIndex } from '../sheets/table.js';

const COURSE_HEADERS = SHEET_HEADERS.courses;

export function imagePublicUrl(_courseId: string, imageFileId: string): string {
  const stored = String(imageFileId || '').trim();
  if (!stored) {
    return '';
  }
  if (isHttpsUrl(stored)) {
    return stored;
  }
  return '';
}

export type CourseRecord = Course & {
  imageFileId: string;
  imageMimeType: string;
};

function parseBooleanCell(raw: string | undefined, fallback = true): boolean {
  const value = String(raw || '')
    .trim()
    .toLowerCase();
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return fallback;
}

export function toCourseResponse(record: CourseRecord): Course {
  const activityType = normalizeActivityType(record.activityType);
  const programCode = normalizeProgramCode(record.courseType, record.programCode);
  return CourseSchema.parse({
    id: record.id,
    activityType,
    targetAudience: activityAudience(activityType),
    courseType: record.courseType,
    programCode,
    title: record.title,
    whatsappTemplate: record.whatsappTemplate,
    isActive: record.isActive,
    hasImage: Boolean(record.imageFileId),
    imageUrl: imagePublicUrl(record.id, record.imageFileId),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    createdBy: record.createdBy,
    updatedBy: record.updatedBy
  });
}

export function applyCourseDefaults(
  input: CreateCourseRequest | UpdateCourseRequest,
  timestamp: string,
  actorEmail: string,
  options: {
    id: string;
    existing?: CourseRecord;
    imageFileId?: string;
    imageMimeType?: string;
  }
): CourseRecord {
  const activityType = normalizeActivityType(input.activityType);
  const courseType =
    activityType === 'Course' ? String(input.courseType || '').trim() : '';
  const programCode =
    activityType === 'Course'
      ? normalizeProgramCode(courseType, input.programCode)
      : '';
  const imageFileId = options.imageFileId ?? options.existing?.imageFileId ?? '';
  const imageMimeType = options.imageMimeType ?? options.existing?.imageMimeType ?? '';
  const record: CourseRecord = {
    id: options.id,
    activityType,
    targetAudience: activityAudience(activityType),
    courseType,
    programCode,
    title:
      activityType === 'Event'
        ? String(input.title || '').trim()
        : formatCourseTitle(courseType, programCode),
    whatsappTemplate:
      String(input.whatsappTemplate || '').trim() ||
      options.existing?.whatsappTemplate ||
      templateForActivity(activityType, courseType, programCode),
    isActive: input.isActive,
    hasImage: Boolean(imageFileId),
    imageUrl: imagePublicUrl(options.id, imageFileId),
    createdAt: options.existing?.createdAt || timestamp,
    updatedAt: timestamp,
    createdBy: options.existing?.createdBy || actorEmail,
    updatedBy: actorEmail,
    imageFileId,
    imageMimeType
  };
  return record;
}

export function courseFromRow(headers: string[], row: string[]): CourseRecord | null {
  const record: Record<string, string> = {};
  headers.forEach((header, index) => {
    if (header) {
      record[header] = String(row[index] || '').trim();
    }
  });
  const activityType = normalizeActivityType(record.activityType);
  const courseType = activityType === 'Course' ? record.courseType || '' : '';
  const programCode =
    activityType === 'Course'
      ? normalizeProgramCode(courseType, record.programCode)
      : '';
  if (
    !record.id ||
    (activityType === 'Course' && !courseType) ||
    (activityType === 'Event' && !String(record.title || '').trim())
  ) {
    return null;
  }
  try {
    return applyCourseDefaults(
      {
        activityType,
        courseType,
        programCode,
        title: record.title || '',
        whatsappTemplate: record.whatsappTemplate || '',
        isActive: parseBooleanCell(record.isActive, true),
        imageBase64: '',
        imageMimeType: record.imageMimeType || ''
      },
      record.updatedAt || record.createdAt || '',
      record.updatedBy || record.createdBy || '',
      {
        id: record.id,
        imageFileId: record.imageFileId || '',
        imageMimeType: record.imageMimeType || '',
        existing: {
          id: record.id,
          activityType,
          targetAudience: activityAudience(activityType),
          courseType,
          programCode,
          title:
            record.title ||
            formatActivityTitle({ activityType, courseType, programCode }),
          whatsappTemplate: record.whatsappTemplate || '',
          isActive: parseBooleanCell(record.isActive, true),
          hasImage: Boolean(record.imageFileId),
          imageUrl: '',
          createdAt: record.createdAt || '',
          updatedAt: record.updatedAt || '',
          createdBy: record.createdBy || '',
          updatedBy: record.updatedBy || '',
          imageFileId: record.imageFileId || '',
          imageMimeType: record.imageMimeType || ''
        }
      }
    );
  } catch {
    return null;
  }
}

export function courseToRow(headers: string[], course: CourseRecord): string[] {
  const cells: Record<string, string> = {
    id: course.id,
    activityType: normalizeActivityType(course.activityType),
    courseType: course.courseType || '',
    programCode: normalizeProgramCode(course.courseType, course.programCode),
    title: course.title || '',
    whatsappTemplate: course.whatsappTemplate || '',
    imageFileId: course.imageFileId || '',
    imageMimeType: course.imageMimeType || '',
    isActive: course.isActive ? 'true' : 'false',
    createdAt: course.createdAt || '',
    updatedAt: course.updatedAt || '',
    createdBy: course.createdBy || '',
    updatedBy: course.updatedBy || ''
  };
  return headers.map((header) => cells[header] || '');
}

export function resolveCourseIdColumn(headers: string[]): number {
  return findHeaderIndex(headers, ['id']);
}

export function expectedCourseHeaders(): readonly string[] {
  return COURSE_HEADERS;
}

export function hasDuplicateCourseSlot(
  courses: readonly {
    activityType?: string;
    id?: string;
    courseType?: string;
    programCode?: string;
  }[],
  candidate: {
    activityType?: string;
    id?: string;
    courseType: string;
    programCode?: string;
  }
): boolean {
  if (!isCourseActivity(candidate)) {
    return false;
  }
  const wanted = courseSlotKey(candidate.courseType, candidate.programCode);
  return courses.some(
    (course) =>
      isCourseActivity(course) &&
      course.id !== candidate.id &&
      courseSlotKey(course.courseType || '', course.programCode) === wanted
  );
}

export function templatesFromRows(rows: string[][]): Array<{
  courseType: string;
  template: string;
}> {
  const headers = (rows[0] || []).map((value) => String(value || '').trim());
  const typeIndex = findHeaderIndex(headers, ['courseType']);
  const templateIndex = findHeaderIndex(headers, ['template']);
  if (typeIndex < 0 || templateIndex < 0) {
    return [];
  }
  return rows
    .slice(1)
    .map((row) => ({
      courseType: String(row[typeIndex] || '').trim(),
      template: String(row[templateIndex] || '')
    }))
    .filter((item) => item.courseType);
}
