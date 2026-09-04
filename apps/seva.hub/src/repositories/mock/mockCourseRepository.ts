import type { CourseRepository } from '../contracts';
import { nanoid } from 'nanoid';
import {
  CreateCourseRequestSchema,
  CreateCourseResponseSchema,
  DeleteCourseRequestSchema,
  DeleteCourseResponseSchema,
  ListCoursesResponseSchema,
  UpdateCourseRequestSchema,
  UpdateCourseResponseSchema,
  type Course,
  type CreateCourseRequest,
  type CreateCourseResponse,
  type DeleteCourseRequest,
  type DeleteCourseResponse,
  type ListCoursesResponse,
  type UpdateCourseRequest,
  type UpdateCourseResponse
} from '../../../shared/contracts/appContracts';
import {
  activityAudience,
  formatActivityTitle,
  normalizeActivityType,
  normalizeProgramCode
} from '../../../shared/contracts/courseDefaults.mjs';
import {
  defaultCourseTemplates,
  templateForActivity
} from '../../../shared/contracts/courseTemplates.mjs';
import { mockCourses } from './mockCourses';

function toCourse(
  parsed: CreateCourseRequest | UpdateCourseRequest,
  options: { id: string; existing?: Course }
): Course {
  const activityType = normalizeActivityType(parsed.activityType);
  const courseType =
    activityType === 'Course' ? String(parsed.courseType || '').trim() : '';
  const programCode =
    activityType === 'Course'
      ? normalizeProgramCode(courseType, parsed.programCode)
      : '';
  const hasUpload = Boolean(parsed.imageBase64.trim());
  const hasImage = hasUpload || Boolean(options.existing?.hasImage);
  const activity = {
    activityType,
    title: parsed.title,
    courseType,
    programCode
  };
  return {
    id: options.id,
    activityType,
    targetAudience: activityAudience(activityType),
    courseType,
    programCode,
    title: formatActivityTitle(activity),
    whatsappTemplate:
      parsed.whatsappTemplate.trim() ||
      options.existing?.whatsappTemplate ||
      templateForActivity(activityType, courseType, programCode),
    isActive: parsed.isActive,
    hasImage,
    imageUrl: hasUpload
      ? 'data:' +
        (parsed.imageMimeType || 'image/jpeg') +
        ';base64,' +
        parsed.imageBase64
      : options.existing?.imageUrl || '',
    createdAt: options.existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: options.existing?.createdBy || 'volunteer@example.com',
    updatedBy: 'volunteer@example.com'
  };
}

export class MockCourseRepository implements CourseRepository {
  private courses: Course[] = structuredClone(mockCourses);

  async listCourses(): Promise<ListCoursesResponse> {
    return ListCoursesResponseSchema.parse({
      success: true,
      courses: this.courses.map((course) => ({ ...course })),
      templates: defaultCourseTemplates()
    });
  }

  async createCourse(payload: CreateCourseRequest): Promise<CreateCourseResponse> {
    const parsed = CreateCourseRequestSchema.parse(payload);
    const course = toCourse(parsed, { id: nanoid() });
    this.courses.push(course);
    return CreateCourseResponseSchema.parse({ success: true, course });
  }

  async updateCourse(payload: UpdateCourseRequest): Promise<UpdateCourseResponse> {
    const parsed = UpdateCourseRequestSchema.parse(payload);
    const index = this.courses.findIndex((course) => course.id === parsed.id);
    if (index < 0) {
      throw new Error('Course not found.');
    }
    const course = toCourse(parsed, {
      id: parsed.id,
      existing: this.courses[index]
    });
    this.courses[index] = course;
    return UpdateCourseResponseSchema.parse({ success: true, course });
  }

  async deleteCourse(payload: DeleteCourseRequest): Promise<DeleteCourseResponse> {
    const parsed = DeleteCourseRequestSchema.parse(payload);
    const index = this.courses.findIndex((course) => course.id === parsed.id);
    if (index < 0) {
      throw new Error('Course not found.');
    }
    this.courses.splice(index, 1);
    return DeleteCourseResponseSchema.parse({
      success: true,
      course: { id: parsed.id }
    });
  }
}
