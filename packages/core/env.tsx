import { z } from 'zod';

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

const ServerEnvSchema = z.object({
  APP_DATA_MODE: z.enum(['mock', 'sheets']).default('mock'),
  APP_IDEMPOTENCY_MODE: z.enum(['mock', 'blob']).default('mock'),
  APP_BASE_URL: z.url().default('http://localhost:3000'),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.url().optional(),
  SESSION_SECRETS: z.string().min(32),
  SESSION_COOKIE_NAME: z.string().min(1).default('app_session'),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  GOOGLE_SHEETS_DATA_SPREADSHEET_ID: z.string().min(1).optional(),
  GOOGLE_SHEETS_ACCESS_SPREADSHEET_ID: z.string().min(1).optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.email().optional(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().min(1).optional(),
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
  BLOB_ACCESS: z.enum(['public', 'private']).default('private'),
  BLOB_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(5242880),
  BLOB_NAMESPACE: z
    .string()
    .regex(/^[a-z0-9][a-z0-9/_-]*$/)
    .default('app-kit'),
  META_VERIFY_TOKEN: z.string().min(1).optional(),
  META_ACCESS_TOKEN: z.string().min(1).optional(),
  META_PHONE_NUMBER_ID: z.string().min(1).optional(),
  META_APP_SECRET: z.string().min(1).optional(),
  META_API_VERSION: z
    .string()
    .regex(/^v\d+\.\d+$/)
    .default('v23.0'),
  WHATSAPP_MAX_BODY_BYTES: z.coerce.number().int().positive().default(1000000),
  WHATSAPP_IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().positive().default(86400)
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;
let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (!cached) {
    cached = ServerEnvSchema.parse({
      APP_DATA_MODE: optional('APP_DATA_MODE'),
      APP_IDEMPOTENCY_MODE: optional('APP_IDEMPOTENCY_MODE'),
      APP_BASE_URL: optional('APP_BASE_URL'),
      GOOGLE_CLIENT_ID: optional('GOOGLE_CLIENT_ID'),
      GOOGLE_CLIENT_SECRET: optional('GOOGLE_CLIENT_SECRET'),
      GOOGLE_REDIRECT_URI: optional('GOOGLE_REDIRECT_URI'),
      SESSION_SECRETS:
        optional('SESSION_SECRETS') ||
        optional('SESSION_SECRET') ||
        (process.env.NODE_ENV === 'production'
          ? undefined
          : 'local-development-secret-change-before-production'),
      SESSION_COOKIE_NAME: optional('SESSION_COOKIE_NAME'),
      SESSION_TTL_SECONDS: optional('SESSION_TTL_SECONDS'),
      GOOGLE_SHEETS_DATA_SPREADSHEET_ID: optional('GOOGLE_SHEETS_DATA_SPREADSHEET_ID'),
      GOOGLE_SHEETS_ACCESS_SPREADSHEET_ID: optional(
        'GOOGLE_SHEETS_ACCESS_SPREADSHEET_ID'
      ),
      GOOGLE_SERVICE_ACCOUNT_EMAIL: optional('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: optional(
        'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'
      ),
      BLOB_READ_WRITE_TOKEN: optional('BLOB_READ_WRITE_TOKEN'),
      BLOB_ACCESS: optional('BLOB_ACCESS'),
      BLOB_MAX_UPLOAD_BYTES: optional('BLOB_MAX_UPLOAD_BYTES'),
      BLOB_NAMESPACE: optional('BLOB_NAMESPACE'),
      META_VERIFY_TOKEN: optional('META_VERIFY_TOKEN'),
      META_ACCESS_TOKEN: optional('META_ACCESS_TOKEN'),
      META_PHONE_NUMBER_ID: optional('META_PHONE_NUMBER_ID'),
      META_APP_SECRET: optional('META_APP_SECRET'),
      META_API_VERSION: optional('META_API_VERSION'),
      WHATSAPP_MAX_BODY_BYTES: optional('WHATSAPP_MAX_BODY_BYTES'),
      WHATSAPP_IDEMPOTENCY_TTL_SECONDS: optional('WHATSAPP_IDEMPOTENCY_TTL_SECONDS')
    });
  }
  return cached;
}

export function getAuthEnv() {
  const env = getServerEnv();
  return z
    .object({
      GOOGLE_CLIENT_ID: z.string().min(1),
      GOOGLE_CLIENT_SECRET: z.string().min(1),
      GOOGLE_REDIRECT_URI: z.url()
    })
    .parse(env);
}

export function getSheetsEnv() {
  const env = getServerEnv();
  const required = z
    .object({
      GOOGLE_SHEETS_DATA_SPREADSHEET_ID: z.string().min(1),
      GOOGLE_SERVICE_ACCOUNT_EMAIL: z.email(),
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().min(1)
    })
    .parse(env);
  return {
    ...env,
    ...required,
    GOOGLE_SHEETS_ACCESS_SPREADSHEET_ID:
      env.GOOGLE_SHEETS_ACCESS_SPREADSHEET_ID ||
      required.GOOGLE_SHEETS_DATA_SPREADSHEET_ID
  };
}

export function getWhatsAppEnv() {
  return z
    .object({
      META_VERIFY_TOKEN: z.string().min(1),
      META_ACCESS_TOKEN: z.string().min(1),
      META_PHONE_NUMBER_ID: z.string().min(1),
      META_APP_SECRET: z.string().min(1),
      META_API_VERSION: z.string().min(1),
      WHATSAPP_MAX_BODY_BYTES: z.number().int().positive(),
      WHATSAPP_IDEMPOTENCY_TTL_SECONDS: z.number().int().positive()
    })
    .parse(getServerEnv());
}

export function __resetEnvForTests() {
  cached = null;
}
