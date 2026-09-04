import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  name: z.string().min(1),
  picture: z.url().optional()
});

export const ResourceValueSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()])
);

export const ResourceRecordSchema = ResourceValueSchema.and(
  z.object({
    id: z.string().min(1),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime()
  })
);

export const ApiErrorCodeSchema = z.enum([
  'METHOD_NOT_ALLOWED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'CSRF_REJECTED',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
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

export const SessionResponseSchema = z.object({
  success: z.literal(true),
  user: UserSchema.nullable(),
  csrfToken: z.string().default('')
});

export const ResourceListResponseSchema = z.object({
  success: z.literal(true),
  records: z.array(ResourceRecordSchema)
});

export const ResourceWriteResponseSchema = z.object({
  success: z.literal(true),
  record: ResourceRecordSchema
});

export const ResourceDeleteResponseSchema = z.object({
  success: z.literal(true),
  id: z.string().min(1)
});

export const FileResponseSchema = z.object({
  success: z.literal(true),
  pathname: z.string().min(1),
  url: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().nonnegative()
});

export type User = z.infer<typeof UserSchema>;
export type ResourceValue = z.infer<typeof ResourceValueSchema>;
export type ResourceRecord = z.infer<typeof ResourceRecordSchema>;
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
