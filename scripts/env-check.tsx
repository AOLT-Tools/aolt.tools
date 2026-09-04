import { loadLocalEnv } from './_env.js';

loadLocalEnv();

const required = new Set([
  'VITE_APP_MODE',
  'APP_DATA_MODE',
  'APP_IDEMPOTENCY_MODE',
  'APP_BASE_URL',
  'SESSION_SECRETS'
]);

if (process.env.VITE_APP_MODE === 'api') {
  ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'].forEach((key) =>
    required.add(key)
  );
}
if (process.env.APP_DATA_MODE === 'sheets') {
  [
    'GOOGLE_SHEETS_DATA_SPREADSHEET_ID',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'
  ].forEach((key) => required.add(key));
}
if (process.env.APP_IDEMPOTENCY_MODE === 'blob') {
  [
    'META_VERIFY_TOKEN',
    'META_ACCESS_TOKEN',
    'META_PHONE_NUMBER_ID',
    'META_APP_SECRET'
  ].forEach((key) => required.add(key));
}

const missing = [...required].filter((key) => !String(process.env[key] || '').trim());
if (
  String(process.env.SESSION_SECRETS || '')
    .split(',')[0]
    .trim().length < 32
) {
  missing.push('SESSION_SECRETS (first key must contain at least 32 characters)');
}
if (missing.length) {
  console.error('Environment validation failed:\n- ' + missing.join('\n- '));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      valid: true,
      appMode: process.env.VITE_APP_MODE,
      dataMode: process.env.APP_DATA_MODE,
      idempotencyMode: process.env.APP_IDEMPOTENCY_MODE,
      usesSeparateAccessSheet: Boolean(process.env.GOOGLE_SHEETS_ACCESS_SPREADSHEET_ID),
      blobAuthentication: process.env.BLOB_READ_WRITE_TOKEN
        ? 'explicit-token'
        : 'vercel-oidc'
    },
    null,
    2
  )
);
