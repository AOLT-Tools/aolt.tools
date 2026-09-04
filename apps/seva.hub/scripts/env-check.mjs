import { loadEnv } from './env.mjs';

function isMissing(env, key) {
  const value = env[key];
  return typeof value !== 'string' || value.trim().length === 0;
}

const env = loadEnv();
const requiredCommon = ['VITE_APP_MODE', 'APP_DATA_MODE'];

const requiredApiAuth = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'SESSION_SECRET',
  'SESSION_COOKIE_NAME'
];

const requiredSheets = [
  'GOOGLE_SHEETS_DATA_SPREADSHEET_ID',
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
  'BLOB_READ_WRITE_TOKEN'
];

const requiredWhatsApp = [
  'META_VERIFY_TOKEN',
  'META_ACCESS_TOKEN',
  'META_PHONE_NUMBER_ID',
  'META_APP_SECRET'
];

const missing = [];
for (const key of requiredCommon) {
  if (isMissing(env, key)) {
    missing.push(key);
  }
}

if ((env.VITE_APP_MODE || '').trim() === 'api') {
  for (const key of requiredApiAuth) {
    if (isMissing(env, key)) {
      missing.push(key);
    }
  }
}

if ((env.APP_DATA_MODE || '').trim() === 'sheets') {
  for (const key of requiredSheets) {
    if (isMissing(env, key)) {
      missing.push(key);
    }
  }
}

if (
  (env.VITE_APP_MODE || '').trim() === 'api' &&
  (env.APP_DATA_MODE || '').trim() === 'sheets'
) {
  for (const key of requiredWhatsApp) {
    if (isMissing(env, key)) {
      missing.push(key);
    }
  }
}

const diagnostics = {
  appMode: env.VITE_APP_MODE || '(unset)',
  dataMode: env.APP_DATA_MODE || '(unset)',
  hasAccessSpreadsheetId: !!(env.GOOGLE_SHEETS_ACCESS_SPREADSHEET_ID || '').trim(),
  privateKeyFormatLooksEscaped: (env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').includes(
    '\\n'
  )
};

if (missing.length) {
  console.error('Environment validation failed. Missing required variables:');
  for (const key of missing) {
    console.error('- ' + key);
  }
  console.error('\nDiagnostics:', JSON.stringify(diagnostics, null, 2));
  process.exit(1);
}

console.log('Environment validation passed.');
console.log(JSON.stringify(diagnostics, null, 2));
