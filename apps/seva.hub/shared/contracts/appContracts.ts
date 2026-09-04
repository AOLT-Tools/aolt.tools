import { z } from 'zod';
import { normalizeIndianMobile } from '@aolt/core/normalization';
import { inspectImageUpload } from './activityImage.js';

const NanoIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{21}$/, 'Expected a Nano ID (21 chars).');

export const AuthenticatedUserSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  name: z.string().optional(),
  picture: z.string().optional()
});

export const CampaignSchema = z.object({
  id: NanoIdSchema,
  name: z.string().min(1),
  type: z.enum(['Leads', 'Members']),
  message: z.string().optional(),
  showDonePrograms: z.boolean().optional()
});

export const ProgramSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1)
});

export const CampaignUiMetaSchema = z.object({
  queueTitle: z.string().min(1),
  filterOptions: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1)
      })
    )
    .default([])
});

export const QualityMetaSchema = z.object({
  icon: z.string().min(1),
  className: z.string().min(1)
});

export const VolunteerSchema = z.object({
  email: z.email(),
  name: z.string().min(1)
});

export const AppConfigSchema = z.object({
  id: NanoIdSchema,
  campaigns: z.array(CampaignSchema).default([]),
  programs: z.array(ProgramSchema).default([]),
  programDisplayOrder: z.array(z.string()).default([]),
  showDonePrograms: z.boolean().optional(),
  uiByType: z.record(z.string(), CampaignUiMetaSchema).optional(),
  qualityMetaMap: z.record(z.string(), QualityMetaSchema).optional(),
  statusIconMap: z.record(z.string(), z.string()).optional(),
  defaultStatusIcon: z.string().optional(),
  defaultCampaignMessage: z.string().optional(),
  whatsappCountryCode: z.string().optional(),
  centerWhatsappNumber: z.string().optional(),
  allowedUsers: z.array(z.email()).default([]),
  volunteers: z.array(VolunteerSchema).default([])
});

export const LeadSchema = z.object({
  id: z.string().min(1),
  mobile: z.string().default(''),
  name: z.string().default(''),
  quality: z.string().default('Quality'),
  followUp: z.string().default('Follow-up'),
  lastUpdated: z.string().default('Just now'),
  status: z.string().default('Response'),
  notes: z.string().default(''),
  campaignId: z.string().optional(),
  campaignType: z.enum(['Leads', 'Members']).optional(),
  assignedVolunteerEmail: z.string().default(''),
  wishlistPrograms: z.string().default(''),
  donePrograms: z.string().default('')
});

export const BootstrapResponseSchema = z.object({
  success: z.literal(true),
  user: AuthenticatedUserSchema,
  campaignId: NanoIdSchema,
  config: AppConfigSchema,
  leads: z.array(LeadSchema)
});

export const ApiErrorCodeSchema = z.enum([
  'METHOD_NOT_ALLOWED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'UPSTREAM_TIMEOUT',
  'UPSTREAM_ERROR',
  'INTERNAL_ERROR'
]);

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string(),
    retryable: z.boolean(),
    traceId: z.string().min(1)
  })
});

export const UpdateLeadRequestSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  status: z.string().optional(),
  quality: z.string().optional(),
  followUp: z.string().optional(),
  notes: z.string().optional(),
  campaignId: NanoIdSchema,
  campaignType: z.enum(['Leads', 'Members']),
  assignedVolunteerEmail: z.email().optional(),
  wishlistPrograms: z.string().optional(),
  donePrograms: z.string().optional()
});

export const UpdateLeadResponseSchema = z.object({
  success: z.literal(true),
  lead: z.object({
    id: z.string().min(1),
    lastUpdated: z.string().min(1)
  })
});

export const CreateLeadRequestSchema = z.object({
  name: z.string().trim().min(1),
  mobile: z
    .string()
    .trim()
    .min(1)
    .refine((value) => Boolean(normalizeIndianMobile(value)), {
      message: 'Enter a valid 10-digit Indian mobile number.'
    })
    .transform((value) => normalizeIndianMobile(value)),
  notes: z.string().optional(),
  campaignId: NanoIdSchema,
  campaignType: z.enum(['Leads', 'Members'])
});

export const CreateLeadResponseSchema = z.object({
  success: z.literal(true),
  lead: LeadSchema
});

export const DeleteLeadRequestSchema = z.object({
  id: z.string().min(1),
  campaignType: z.enum(['Leads', 'Members'])
});

export const DeleteLeadResponseSchema = z.object({
  success: z.literal(true),
  lead: z.object({ id: z.string().min(1) })
});

export const MAX_MEMBERS_PER_VOLUNTEER = 100;

export const AssignMembersRequestSchema = z.object({
  campaignId: NanoIdSchema,
  count: z.number().int().min(1).max(MAX_MEMBERS_PER_VOLUNTEER),
  engagementLevels: z
    .array(z.string().trim().max(100))
    .default([])
    .transform((values) =>
      values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .filter((value, index, allValues) => allValues.indexOf(value) === index)
    )
});

export const AssignMembersResponseSchema = z.object({
  success: z.literal(true),
  requestedCount: z.number().int().min(1),
  assignedCount: z.number().int().min(0),
  remainingCapacity: z.number().int().min(0),
  members: z.array(LeadSchema)
});

export const ActivityTypeSchema = z.enum(['Course', 'Event']);
export const ActivityAudienceSchema = z.enum(['Leads', 'Members']);

export const CourseWriteFieldsSchema = z
  .object({
    activityType: ActivityTypeSchema,
    courseType: z.string().trim().default(''),
    programCode: z.string().trim().default(''),
    title: z.string().trim().max(140).default(''),
    whatsappTemplate: z.string().default(''),
    isActive: z.boolean().default(true),
    imageBase64: z.string().default(''),
    imageMimeType: z.string().default(''),
    clearImage: z.boolean().optional()
  })
  .superRefine((data, ctx) => {
    if (data.activityType === 'Event') {
      if (!data.title.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Enter an event name.',
          path: ['title']
        });
      }
      if (data.courseType.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Course type is only used for courses.',
          path: ['courseType']
        });
      }
      if (data.programCode.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Program is only used for courses.',
          path: ['programCode']
        });
      }
    }

    if (data.activityType === 'Course' && !data.courseType.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Choose a course type.',
        path: ['courseType']
      });
    }

    const type = String(data.courseType || '')
      .trim()
      .toUpperCase();
    const program = String(data.programCode || '')
      .trim()
      .toLowerCase();
    if (data.activityType === 'Course' && type === 'IP') {
      if (program !== 'j' && program !== 's') {
        ctx.addIssue({
          code: 'custom',
          message: 'Choose Junior or Senior for IP.',
          path: ['programCode']
        });
      }
    } else if (data.activityType === 'Course' && program) {
      ctx.addIssue({
        code: 'custom',
        message: 'Program is only used for IP.',
        path: ['programCode']
      });
    }
    const raw = String(data.imageBase64 || '').trim();
    if (!raw) {
      return;
    }
    const inspected = inspectImageUpload(raw, data.imageMimeType);
    if (!inspected.ok) {
      ctx.addIssue({
        code: 'custom',
        message: inspected.message,
        path: ['imageBase64']
      });
    }
  });

export const CourseSchema = z.object({
  id: NanoIdSchema,
  activityType: ActivityTypeSchema,
  targetAudience: ActivityAudienceSchema,
  courseType: z.string().trim().default(''),
  programCode: z.string().trim().default(''),
  title: z.string().default(''),
  whatsappTemplate: z.string().default(''),
  isActive: z.boolean().default(true),
  hasImage: z.boolean().default(false),
  imageUrl: z.string().default(''),
  createdAt: z.string().default(''),
  updatedAt: z.string().default(''),
  createdBy: z.string().default(''),
  updatedBy: z.string().default('')
});

export const CourseTemplateSchema = z.object({
  courseType: z.string().trim().min(1),
  template: z.string()
});

export const CreateCourseRequestSchema = CourseWriteFieldsSchema;
export const UpdateCourseRequestSchema = CourseWriteFieldsSchema.extend({
  id: NanoIdSchema
});
export const DeleteCourseRequestSchema = z.object({
  id: NanoIdSchema
});

export const ListCoursesResponseSchema = z.object({
  success: z.literal(true),
  courses: z.array(CourseSchema),
  templates: z.array(CourseTemplateSchema).default([])
});

export const HomepageProgramOfferSchema = z.object({
  code: z.string().trim().min(1),
  label: z.string().trim().min(1),
  active: z.boolean(),
  registerPath: z.string().trim().min(1)
});

export const PublicHomepageOffersResponseSchema = z.object({
  success: z.literal(true),
  offers: z.array(HomepageProgramOfferSchema),
  whatsappNumber: z.string().default('')
});
export const CreateCourseResponseSchema = z.object({
  success: z.literal(true),
  course: CourseSchema
});
export const UpdateCourseResponseSchema = CreateCourseResponseSchema;
export const DeleteCourseResponseSchema = z.object({
  success: z.literal(true),
  course: z.object({ id: NanoIdSchema })
});

export type AuthenticatedUser = z.infer<typeof AuthenticatedUserSchema>;
export type Campaign = z.infer<typeof CampaignSchema>;
export type Lead = z.infer<typeof LeadSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;
export type BootstrapResponse = z.infer<typeof BootstrapResponseSchema>;
export type UpdateLeadRequest = z.infer<typeof UpdateLeadRequestSchema>;
export type UpdateLeadResponse = z.infer<typeof UpdateLeadResponseSchema>;
export type CreateLeadRequest = z.infer<typeof CreateLeadRequestSchema>;
export type CreateLeadResponse = z.infer<typeof CreateLeadResponseSchema>;
export type DeleteLeadRequest = z.infer<typeof DeleteLeadRequestSchema>;
export type DeleteLeadResponse = z.infer<typeof DeleteLeadResponseSchema>;
export type AssignMembersRequest = z.infer<typeof AssignMembersRequestSchema>;
export type AssignMembersResponse = z.infer<typeof AssignMembersResponseSchema>;
export type Course = z.infer<typeof CourseSchema>;
export type CourseTemplate = z.infer<typeof CourseTemplateSchema>;
export type CreateCourseRequest = z.infer<typeof CreateCourseRequestSchema>;
export type UpdateCourseRequest = z.infer<typeof UpdateCourseRequestSchema>;
export type DeleteCourseRequest = z.infer<typeof DeleteCourseRequestSchema>;
export type ListCoursesResponse = z.infer<typeof ListCoursesResponseSchema>;
export type HomepageProgramOffer = z.infer<typeof HomepageProgramOfferSchema>;
export type PublicHomepageOffersResponse = z.infer<
  typeof PublicHomepageOffersResponseSchema
>;
export type CreateCourseResponse = z.infer<typeof CreateCourseResponseSchema>;
export type UpdateCourseResponse = z.infer<typeof UpdateCourseResponseSchema>;
export type DeleteCourseResponse = z.infer<typeof DeleteCourseResponseSchema>;
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorSchema>;
