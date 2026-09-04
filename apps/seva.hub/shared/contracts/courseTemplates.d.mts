export const DEFAULT_COURSE_WHATSAPP_TEMPLATE: string;
export const DEFAULT_EVENT_WHATSAPP_TEMPLATE: string;
export const DEFAULT_HP_WHATSAPP_TEMPLATE: string;
export const DEFAULT_COURSE_TEMPLATE_TYPES: readonly string[];

export function templateLookupKeys(courseType: string, programCode?: string): string[];
export function templateForCourseType(courseType: string, programCode?: string): string;
export function templateForActivity(
  activityType: string,
  courseType?: string,
  programCode?: string
): string;
export function defaultCourseTemplateRows(): string[][];
export function defaultCourseTemplates(): Array<{
  courseType: string;
  template: string;
}>;
