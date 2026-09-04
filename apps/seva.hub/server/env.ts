import { z } from 'zod';

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

const ServerEnvSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_SHEETS_DATA_SPREADSHEET_ID: z.string().min(1).optional(),
  GOOGLE_SHEETS_ACCESS_SPREADSHEET_ID: z.string().min(1).optional(),
  GOOGLE_SHEETS_LAYOUT_JSON: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email().optional(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().min(1).optional(),
  META_VERIFY_TOKEN: z.string().min(1).optional(),
  META_ACCESS_TOKEN: z.string().min(1).optional(),
  META_PHONE_NUMBER_ID: z.string().min(1).optional(),
  META_APP_SECRET: z.string().min(1).optional(),
  META_API_VERSION: z.string().min(1).default('v21.0'),
  WHATSAPP_PENDING_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  SESSION_SECRET: z.string().min(32),
  SESSION_COOKIE_NAME: z.string().min(1).default('seva_hub_session'),
  APP_DATA_MODE: z.enum(['mock', 'sheets']).default('mock')
});

let parsedEnv: z.infer<typeof ServerEnvSchema> | null = null;

export function getServerEnv() {
  if (parsedEnv) {
    return parsedEnv;
  }

  parsedEnv = ServerEnvSchema.parse({
    GOOGLE_CLIENT_ID: optionalEnv('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET: optionalEnv('GOOGLE_CLIENT_SECRET'),
    GOOGLE_REDIRECT_URI: optionalEnv('GOOGLE_REDIRECT_URI'),
    GOOGLE_SHEETS_DATA_SPREADSHEET_ID: optionalEnv('GOOGLE_SHEETS_DATA_SPREADSHEET_ID'),
    GOOGLE_SHEETS_ACCESS_SPREADSHEET_ID: optionalEnv(
      'GOOGLE_SHEETS_ACCESS_SPREADSHEET_ID'
    ),
    GOOGLE_SHEETS_LAYOUT_JSON: optionalEnv('GOOGLE_SHEETS_LAYOUT_JSON'),
    GOOGLE_SERVICE_ACCOUNT_EMAIL: optionalEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: optionalEnv(
      'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'
    ),
    META_VERIFY_TOKEN: optionalEnv('META_VERIFY_TOKEN'),
    META_ACCESS_TOKEN: optionalEnv('META_ACCESS_TOKEN'),
    META_PHONE_NUMBER_ID: optionalEnv('META_PHONE_NUMBER_ID'),
    META_APP_SECRET: optionalEnv('META_APP_SECRET'),
    META_API_VERSION: optionalEnv('META_API_VERSION'),
    WHATSAPP_PENDING_TTL_SECONDS: optionalEnv('WHATSAPP_PENDING_TTL_SECONDS'),
    SESSION_SECRET: process.env.SESSION_SECRET,
    SESSION_COOKIE_NAME: optionalEnv('SESSION_COOKIE_NAME'),
    APP_DATA_MODE: optionalEnv('APP_DATA_MODE')
  });

  return parsedEnv;
}

export function getOAuthEnv() {
  const env = getServerEnv();
  const OAuthEnvSchema = z.object({
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1)
  });

  return {
    ...env,
    ...OAuthEnvSchema.parse({
      GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET
    })
  };
}

export function getSheetsEnv() {
  const env = getServerEnv();
  const SheetsEnvSchema = z.object({
    GOOGLE_SHEETS_DATA_SPREADSHEET_ID: z.string().min(1),
    GOOGLE_SERVICE_ACCOUNT_EMAIL: z.email(),
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().min(1)
  });

  const parsed = SheetsEnvSchema.parse({
    GOOGLE_SHEETS_DATA_SPREADSHEET_ID: env.GOOGLE_SHEETS_DATA_SPREADSHEET_ID,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  });

  return {
    ...env,
    ...parsed,
    GOOGLE_SHEETS_ACCESS_SPREADSHEET_ID:
      env.GOOGLE_SHEETS_ACCESS_SPREADSHEET_ID ||
      parsed.GOOGLE_SHEETS_DATA_SPREADSHEET_ID
  };
}

export function getWhatsAppVerifyEnv() {
  const VerifyEnvSchema = z.object({
    META_VERIFY_TOKEN: z.string().min(1)
  });

  return VerifyEnvSchema.parse({
    META_VERIFY_TOKEN: optionalEnv('META_VERIFY_TOKEN')
  });
}

export function getWhatsAppSignatureEnv() {
  const SignatureEnvSchema = z.object({
    META_APP_SECRET: z.string().min(1)
  });

  return SignatureEnvSchema.parse({
    META_APP_SECRET: optionalEnv('META_APP_SECRET')
  });
}

export function getWhatsAppMessagingEnv() {
  const MessagingEnvSchema = z.object({
    META_ACCESS_TOKEN: z.string().min(1),
    META_PHONE_NUMBER_ID: z.string().min(1),
    META_API_VERSION: z.string().min(1)
  });

  return MessagingEnvSchema.parse({
    META_ACCESS_TOKEN: optionalEnv('META_ACCESS_TOKEN'),
    META_PHONE_NUMBER_ID: optionalEnv('META_PHONE_NUMBER_ID'),
    META_API_VERSION: optionalEnv('META_API_VERSION') || 'v21.0'
  });
}

export function getWhatsAppPendingEnv() {
  const ttlRaw = optionalEnv('WHATSAPP_PENDING_TTL_SECONDS');
  const ttl = Number(ttlRaw || 300);

  return {
    WHATSAPP_PENDING_TTL_SECONDS: Number.isInteger(ttl) && ttl > 0 ? ttl : 300
  };
}
