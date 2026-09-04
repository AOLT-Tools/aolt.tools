import { JWT } from 'google-auth-library';
import {
  DEFAULT_SHEET_LAYOUT,
  REQUIRED_CONFIG_KEYS,
  SHEET_HEADERS
} from '../shared/contracts/sheetContract.mjs';
import { defaultCourseTemplateRows } from '../shared/contracts/courseTemplates.mjs';
import { loadEnv } from './env.mjs';

const SHOULD_FIX = process.argv.includes('--fix');
const REQUEST_TIMEOUT_MS = 10_000;

function querySuffix(query) {
  return query ? '?' + query : '';
}

function buildGoogleSheetsValuesUrl(spreadsheetId, range, query = '') {
  return (
    'https://sheets.googleapis.com/v4/spreadsheets/' +
    spreadsheetId +
    '/values/' +
    encodeURIComponent(range) +
    querySuffix(query)
  );
}

function buildGoogleSheetsAppendUrl(spreadsheetId, range, query = '') {
  return (
    buildGoogleSheetsValuesUrl(spreadsheetId, range) + ':append' + querySuffix(query)
  );
}

async function withDeadline(promise, timeoutMessage, onTimeout) {
  let timeout;
  const deadline = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      onTimeout?.();
      reject(new Error(timeoutMessage));
    }, REQUEST_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, deadline]);
  } finally {
    clearTimeout(timeout);
  }
}

function requireValue(env, key) {
  const value = env[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Missing required env var: ' + key);
  }
  return value.trim();
}

function parseLayout(env) {
  const raw = (env.GOOGLE_SHEETS_LAYOUT_JSON || '').trim();
  if (!raw) {
    return { ...DEFAULT_SHEET_LAYOUT };
  }

  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SHEET_LAYOUT, ...parsed };
  } catch {
    throw new Error('GOOGLE_SHEETS_LAYOUT_JSON is not valid JSON.');
  }
}

function getTabName(range) {
  const idx = range.indexOf('!');
  if (idx < 0) {
    return range;
  }
  return range.slice(0, idx);
}

function columnLabel(columnNumber) {
  let dividend = columnNumber;
  let label = '';
  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    label = String.fromCharCode(65 + modulo) + label;
    dividend = Math.floor((dividend - modulo) / 26);
  }
  return label || 'A';
}

async function fetchJson(client, url, init = {}) {
  const controller = new AbortController();
  const response = await withDeadline(
    client.request({
      url,
      method: init.method || 'GET',
      data: init.data,
      signal: controller.signal
    }),
    'Google Sheets authenticated request timed out.',
    () => controller.abort()
  );
  return response.data;
}

async function getSpreadsheetTitles(client, spreadsheetId) {
  const url =
    'https://sheets.googleapis.com/v4/spreadsheets/' +
    spreadsheetId +
    '?fields=sheets.properties.title';
  const payload = await fetchJson(client, url, { method: 'GET' });
  const sheets = Array.isArray(payload.sheets) ? payload.sheets : [];
  return new Set(
    sheets.map((sheet) => String(sheet?.properties?.title || '')).filter(Boolean)
  );
}

async function addMissingSheets(client, spreadsheetId, titles) {
  if (!titles.length) {
    return;
  }

  const requests = titles.map((title) => ({
    addSheet: {
      properties: { title }
    }
  }));

  const url =
    'https://sheets.googleapis.com/v4/spreadsheets/' + spreadsheetId + ':batchUpdate';
  await fetchJson(client, url, {
    method: 'POST',
    data: { requests }
  });
}

async function readHeader(client, spreadsheetId, tabName) {
  const url = buildGoogleSheetsValuesUrl(spreadsheetId, tabName + '!1:1');
  const payload = await fetchJson(client, url, { method: 'GET' });
  const firstRow =
    Array.isArray(payload.values) && payload.values.length ? payload.values[0] : [];
  return Array.isArray(firstRow) ? firstRow.map((value) => String(value).trim()) : [];
}

async function writeRow(client, spreadsheetId, range, values) {
  const url = buildGoogleSheetsValuesUrl(spreadsheetId, range, 'valueInputOption=RAW');
  await fetchJson(client, url, {
    method: 'PUT',
    data: { values: [values] }
  });
}

function rowMatches(actual, expected) {
  if (actual.length < expected.length) {
    return false;
  }
  for (let i = 0; i < expected.length; i += 1) {
    if ((actual[i] || '').trim() !== expected[i]) {
      return false;
    }
  }
  return true;
}

async function ensureHeader(client, spreadsheetId, tabName, expected) {
  const current = await readHeader(client, spreadsheetId, tabName);
  const ok = rowMatches(current, expected);
  if (ok) {
    console.log('Header OK for ' + tabName);
    return;
  }

  console.warn('Header mismatch in ' + tabName + '. Expected: ' + expected.join(','));
  if (SHOULD_FIX) {
    await writeRow(client, spreadsheetId, tabName + '!A1', expected);
    console.log('Header auto-fixed for ' + tabName);
  }
}

async function ensureExtensibleHeader(client, spreadsheetId, tabName, expected) {
  const current = await readHeader(client, spreadsheetId, tabName);
  const currentNames = new Set(
    current.filter(Boolean).map((header) => header.toLowerCase())
  );
  const missing = expected.filter((header) => !currentNames.has(header.toLowerCase()));
  if (!missing.length) {
    console.log('Header OK for ' + tabName);
    return;
  }

  console.warn('Missing headers in ' + tabName + ': ' + missing.join(','));
  if (!SHOULD_FIX) {
    return;
  }

  if (!current.some((value) => String(value || '').trim())) {
    await writeRow(client, spreadsheetId, tabName + '!A1', expected);
  } else {
    const startColumn = columnLabel(current.length + 1);
    await writeRow(client, spreadsheetId, tabName + '!' + startColumn + '1', missing);
  }
  console.log('Missing headers appended for ' + tabName);
}

async function getSheetId(client, spreadsheetId, tabName) {
  const url =
    'https://sheets.googleapis.com/v4/spreadsheets/' +
    spreadsheetId +
    '?fields=sheets.properties(sheetId,title)';
  const payload = await fetchJson(client, url, { method: 'GET' });
  const sheet = (Array.isArray(payload.sheets) ? payload.sheets : []).find(
    (candidate) => String(candidate?.properties?.title || '') === tabName
  );
  const sheetId = Number(sheet?.properties?.sheetId);
  if (!Number.isInteger(sheetId)) {
    throw new Error('Could not resolve sheet ID for ' + tabName + '.');
  }
  return sheetId;
}

async function insertTopRow(client, spreadsheetId, tabName) {
  const sheetId = await getSheetId(client, spreadsheetId, tabName);
  const url =
    'https://sheets.googleapis.com/v4/spreadsheets/' + spreadsheetId + ':batchUpdate';
  await fetchJson(client, url, {
    method: 'POST',
    data: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: 0,
              endIndex: 1
            },
            inheritFromBefore: false
          }
        }
      ]
    }
  });
}

async function ensureConfigHeader(client, spreadsheetId, tabName) {
  const expected = SHEET_HEADERS.config;
  const current = await readHeader(client, spreadsheetId, tabName);
  if (rowMatches(current, expected)) {
    console.log('Header OK for ' + tabName);
    return;
  }

  console.warn('Header mismatch in ' + tabName + '. Expected: ' + expected.join(','));
  if (!SHOULD_FIX) {
    return;
  }

  if (current.some((value) => String(value || '').trim())) {
    // A legacy Config tab may begin directly with its first key. Preserve that row.
    await insertTopRow(client, spreadsheetId, tabName);
  }
  await writeRow(client, spreadsheetId, tabName + '!A1', expected);
  console.log('Header auto-fixed for ' + tabName);
}

async function ensureConfigKeys(client, spreadsheetId, tabName) {
  const requiredKeys = REQUIRED_CONFIG_KEYS;

  const url = buildGoogleSheetsValuesUrl(spreadsheetId, tabName + '!A:B');
  const payload = await fetchJson(client, url, { method: 'GET' });
  const rows = Array.isArray(payload.values) ? payload.values : [];

  const keys = new Set();
  for (let i = 0; i < rows.length; i += 1) {
    const key = String(rows[i]?.[0] || '').trim();
    if (key && key.toLowerCase() !== 'key') {
      keys.add(key);
    }
  }

  const missing = requiredKeys.filter((key) => !keys.has(key));
  if (!missing.length) {
    console.log('Config keys OK');
    return;
  }

  console.warn('Missing config keys: ' + missing.join(', '));
  if (SHOULD_FIX) {
    const valuesToAppend = missing.map((key) => [key, '']);
    const appendUrl = buildGoogleSheetsAppendUrl(
      spreadsheetId,
      tabName + '!A:B',
      'valueInputOption=RAW&insertDataOption=INSERT_ROWS'
    );
    await fetchJson(client, appendUrl, {
      method: 'POST',
      data: { values: valuesToAppend }
    });
    console.log('Missing config keys appended with blank values');
  }
}

async function ensureCourseTemplates(client, spreadsheetId, tabName) {
  await ensureHeader(client, spreadsheetId, tabName, SHEET_HEADERS.courseTemplates);
  const url = buildGoogleSheetsValuesUrl(spreadsheetId, tabName + '!A:B');
  const payload = await fetchJson(client, url, { method: 'GET' });
  const rows = Array.isArray(payload.values) ? payload.values : [];
  const existing = new Set();
  for (let i = 1; i < rows.length; i += 1) {
    const courseType = String(rows[i]?.[0] || '').trim();
    if (courseType) {
      existing.add(courseType);
    }
  }
  const missing = defaultCourseTemplateRows().filter(
    ([courseType]) => !existing.has(courseType)
  );
  if (!missing.length) {
    console.log('CourseTemplates OK');
    return;
  }
  console.warn('Missing course templates: ' + missing.map((row) => row[0]).join(', '));
  if (!SHOULD_FIX) {
    return;
  }
  const appendUrl = buildGoogleSheetsAppendUrl(
    spreadsheetId,
    tabName + '!A:B',
    'valueInputOption=RAW&insertDataOption=INSERT_ROWS'
  );
  await fetchJson(client, appendUrl, {
    method: 'POST',
    data: { values: missing }
  });
  console.log('Default course templates appended.');
}

async function run() {
  const env = loadEnv();
  const dataSpreadsheetId = requireValue(env, 'GOOGLE_SHEETS_DATA_SPREADSHEET_ID');
  const accessSpreadsheetId =
    (env.GOOGLE_SHEETS_ACCESS_SPREADSHEET_ID || '').trim() || dataSpreadsheetId;
  const serviceAccountEmail = requireValue(env, 'GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const rawPrivateKey = requireValue(env, 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');

  const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
  const layout = parseLayout(env);

  const client = new JWT({
    email: serviceAccountEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  console.log('Starting Sheets diagnostics. Fix mode: ' + (SHOULD_FIX ? 'ON' : 'OFF'));
  console.log('Data spreadsheet: ' + dataSpreadsheetId);
  console.log('Access spreadsheet: ' + accessSpreadsheetId);

  const dataTitlesPromise = getSpreadsheetTitles(client, dataSpreadsheetId);
  const accessTitlesPromise =
    accessSpreadsheetId === dataSpreadsheetId
      ? dataTitlesPromise
      : getSpreadsheetTitles(client, accessSpreadsheetId);
  const [dataTitles, accessTitles] = await Promise.all([
    dataTitlesPromise,
    accessTitlesPromise
  ]);

  const requiredDataTabs = [
    getTabName(layout.campaignsRange),
    getTabName(layout.leadsRange),
    getTabName(layout.membersRange),
    getTabName(layout.coursesRange),
    getTabName(layout.courseTemplatesRange),
    getTabName(layout.shortUrlsRange),
    getTabName(layout.configRange)
  ];
  const requiredAccessTabs = [getTabName(layout.allowedUsersRange)];

  const missingDataTabs = requiredDataTabs.filter((tab) => !dataTitles.has(tab));
  const missingAccessTabs = requiredAccessTabs.filter((tab) => !accessTitles.has(tab));

  if (missingDataTabs.length) {
    console.warn('Missing data tabs: ' + missingDataTabs.join(', '));
    if (SHOULD_FIX) {
      await addMissingSheets(client, dataSpreadsheetId, missingDataTabs);
      console.log('Missing data tabs created.');
    }
  }

  if (missingAccessTabs.length) {
    console.warn('Missing access tabs: ' + missingAccessTabs.join(', '));
    if (SHOULD_FIX) {
      await addMissingSheets(client, accessSpreadsheetId, missingAccessTabs);
      console.log('Missing access tabs created.');
    }
  }

  await Promise.all([
    ensureHeader(
      client,
      dataSpreadsheetId,
      getTabName(layout.campaignsRange),
      SHEET_HEADERS.campaigns
    ),
    ensureExtensibleHeader(
      client,
      dataSpreadsheetId,
      getTabName(layout.leadsRange),
      SHEET_HEADERS.leads
    ),
    ensureExtensibleHeader(
      client,
      dataSpreadsheetId,
      getTabName(layout.membersRange),
      SHEET_HEADERS.members
    ),
    ensureHeader(
      client,
      dataSpreadsheetId,
      getTabName(layout.coursesRange),
      SHEET_HEADERS.courses
    ),
    ensureCourseTemplates(
      client,
      dataSpreadsheetId,
      getTabName(layout.courseTemplatesRange)
    ),
    ensureHeader(
      client,
      dataSpreadsheetId,
      getTabName(layout.shortUrlsRange),
      SHEET_HEADERS.shortUrls
    ),
    ensureHeader(
      client,
      accessSpreadsheetId,
      getTabName(layout.allowedUsersRange),
      SHEET_HEADERS.allowedUsers
    ),
    ensureConfigHeader(client, dataSpreadsheetId, getTabName(layout.configRange))
  ]);

  await ensureConfigKeys(client, dataSpreadsheetId, getTabName(layout.configRange));

  console.log('Sheets diagnostics complete.');
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
