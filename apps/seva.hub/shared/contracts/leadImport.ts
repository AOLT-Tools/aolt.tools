import { normalizeIndianMobile } from '@aolt/core/normalization';

export const MAX_IMPORT_ROWS = 500;
export const PASTE_SHEET_LINK_MESSAGE = 'Paste a Google Sheets link.';
export const CHOOSE_MONTH_MESSAGE = 'Choose a month before importing leads.';
export const SHEET_SHARE_MESSAGE =
  'This sheet could not be read. In Google Sheets, set sharing to Anyone with the link can view, then try again.';
export const SHEET_EMPTY_MESSAGE = 'The sheet has no rows to import.';

const MAX_CSV_CHARS = 1_000_000;
const PUBLIC_SHEET_TIMEOUT_MS = 4_000;
const CAMPAIGN_ID_PATTERN = /^[A-Za-z0-9_-]{21}$/;
const SPREADSHEET_ID_PATTERN = /^[A-Za-z0-9_-]{10,128}$/;

const NAME_ALIASES = new Set([
  'name',
  'fullname',
  'contactname',
  'membername',
  'leadname',
  'personname',
  'participantname',
  'studentname',
  'customername',
  'candidatename',
  'firstname',
  'nameofcontact',
  'contactperson'
]);

const MOBILE_ALIASES = new Set([
  'mobile',
  'mobilenumber',
  'mobileno',
  'mobilenum',
  'phone',
  'phonenumber',
  'phoneno',
  'whatsapp',
  'whatsappnumber',
  'whatsappno',
  'contactnumber',
  'contactno',
  'cell',
  'cellno',
  'cellphone',
  'cellnumber',
  'tel',
  'telephone',
  'telephonenumber',
  'primaryphone',
  'primarymobile'
]);

export type ImportColumn = 'Name' | 'Mobile';

export type GoogleSheetLocation = {
  spreadsheetId: string;
  gid: string;
};

export type PlannedImportLead = {
  name: string;
  mobile: string;
  notes: string;
};

export type LeadImportPlan =
  | { outcome: 'needs_columns'; missingColumns: ImportColumn[] }
  | {
      outcome: 'ready';
      leads: PlannedImportLead[];
      skippedCount: number;
      invalidCount: number;
    };

export type LeadImportErrorCode =
  | 'INVALID_SHEET_URL'
  | 'INVALID_CAMPAIGN'
  | 'SHEET_NOT_READABLE'
  | 'SHEET_EMPTY'
  | 'SHEET_TOO_LARGE';

export class LeadImportError extends Error {
  readonly code: LeadImportErrorCode;

  constructor(code: LeadImportErrorCode, message: string) {
    super(message);
    this.name = 'LeadImportError';
    this.code = code;
  }
}

export function sheetTooLargeMessage(): string {
  return (
    'This sheet has too many rows. Import up to ' +
    String(MAX_IMPORT_ROWS) +
    ' leads at a time.'
  );
}

export function parseGoogleSheetUrl(input: string): GoogleSheetLocation | null {
  const raw = String(input || '').trim();
  if (!raw || raw.length > 2000) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' || url.username || url.password) {
    return null;
  }
  if (url.hostname !== 'docs.google.com' || url.port) {
    return null;
  }

  const match = url.pathname.match(
    /\/spreadsheets\/d\/([A-Za-z0-9_-]{10,128})(?:\/|$)/
  );
  if (!match || !SPREADSHEET_ID_PATTERN.test(match[1])) {
    return null;
  }

  const gidParam = url.searchParams.get('gid');
  const hashGid = url.hash.match(/gid=(\d+)/)?.[1] || '';
  const gid = gidParam || hashGid || '0';
  if (!/^\d+$/.test(gid)) {
    return null;
  }

  return { spreadsheetId: match[1], gid };
}

export function requireSheetLocation(sheetUrl: string): GoogleSheetLocation {
  const location = parseGoogleSheetUrl(sheetUrl);
  if (!location) {
    throw new LeadImportError('INVALID_SHEET_URL', PASTE_SHEET_LINK_MESSAGE);
  }
  return location;
}

export function readImportLeadsRequest(body: unknown): {
  sheetUrl: string;
  campaignId: string;
} {
  const record =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const sheetUrl =
    typeof record.sheetUrl === 'string' ? record.sheetUrl.trim() : '';
  const campaignId =
    typeof record.campaignId === 'string' ? record.campaignId.trim() : '';
  requireSheetLocation(sheetUrl);
  if (!CAMPAIGN_ID_PATTERN.test(campaignId)) {
    throw new LeadImportError('INVALID_CAMPAIGN', CHOOSE_MONTH_MESSAGE);
  }
  return { sheetUrl, campaignId };
}

export function googleSheetCsvUrl(location: GoogleSheetLocation): string {
  return (
    'https://docs.google.com/spreadsheets/d/' +
    location.spreadsheetId +
    '/export?format=csv&gid=' +
    location.gid
  );
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, '');

  const pushRow = () => {
    row.push(cell);
    cell = '';
    if (row.some((value) => value.trim())) {
      rows.push(row);
    }
    row = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') {
        index += 1;
      }
      pushRow();
      continue;
    }
    cell += char;
  }

  if (cell.length || row.length) {
    pushRow();
  }
  return rows;
}

export function acceptSheetGrid(rows: string[][]): string[][] {
  const compact = rows
    .map((row) => row.map((cell) => String(cell || '').slice(0, 2000)))
    .filter((row, index) => index === 0 || row.some((cell) => cell.trim()));
  if (
    !compact.length ||
    !compact.some((row) => row.some((cell) => cell.trim()))
  ) {
    throw new LeadImportError('SHEET_EMPTY', SHEET_EMPTY_MESSAGE);
  }
  const dataCount = compact
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim())).length;
  if (dataCount > MAX_IMPORT_ROWS) {
    throw new LeadImportError('SHEET_TOO_LARGE', sheetTooLargeMessage());
  }
  return compact;
}

function looksLikeCsv(text: string): boolean {
  const sample = text.trimStart().slice(0, 300).toLowerCase();
  if (!sample || sample.startsWith('<') || sample.startsWith('{')) {
    return false;
  }
  return true;
}

export async function fetchPublicSheetCsv(
  location: GoogleSheetLocation,
  fetchImpl: typeof fetch = fetch
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PUBLIC_SHEET_TIMEOUT_MS);
  try {
    const response = await fetchImpl(googleSheetCsvUrl(location), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal
    });
    const text = await response.text();
    if (text.length > MAX_CSV_CHARS) {
      throw new LeadImportError('SHEET_TOO_LARGE', sheetTooLargeMessage());
    }
    if (!response.ok || !looksLikeCsv(text)) {
      return null;
    }
    return text;
  } catch (error) {
    if (error instanceof LeadImportError) {
      throw error;
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function readPublicGoogleSheet(
  sheetUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<string[][]> {
  const location = requireSheetLocation(sheetUrl);
  const csv = await fetchPublicSheetCsv(location, fetchImpl);
  if (csv === null) {
    throw new LeadImportError('SHEET_NOT_READABLE', SHEET_SHARE_MESSAGE);
  }
  return acceptSheetGrid(parseCsv(csv));
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function columnValues(rows: string[][], index: number): string[] {
  const values: string[] = [];
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const value = String(rows[rowIndex]?.[index] || '').trim();
    if (value) {
      values.push(value);
    }
  }
  return values;
}

function matchRatio(
  values: string[],
  match: (value: string) => boolean
): number {
  if (values.length < 2) {
    return 0;
  }
  return values.filter(match).length / values.length;
}

function looksLikeName(value: string): boolean {
  const text = value.trim();
  if (text.length < 2 || text.length > 80) {
    return false;
  }
  if (normalizeIndianMobile(text)) {
    return false;
  }
  if (text.includes('@') || /https?:/i.test(text)) {
    return false;
  }
  if (text.replace(/\D/g, '').length >= 6) {
    return false;
  }
  const letters = text.replace(/[^A-Za-z\u0900-\u097F]/g, '');
  const compact = text.replace(/\s/g, '');
  if (letters.length < 2 || !compact.length) {
    return false;
  }
  return letters.length / compact.length >= 0.6;
}

function uniqueAlias(headers: string[], aliases: Set<string>): number | null {
  const matches: number[] = [];
  headers.forEach((header, index) => {
    if (aliases.has(normalizeHeader(header))) {
      matches.push(index);
    }
  });
  return matches.length === 1 ? matches[0] : null;
}

function pickColumn(scores: number[], taken: number | null): number | null {
  let bestIndex = -1;
  let bestScore = 0;
  let secondScore = 0;
  scores.forEach((score, index) => {
    if (index === taken) {
      return;
    }
    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestIndex = index;
    } else if (score > secondScore) {
      secondScore = score;
    }
  });
  if (bestIndex < 0 || bestScore < 0.6 || bestScore - secondScore < 0.25) {
    return null;
  }
  return bestIndex;
}

function buildNotes(
  headers: string[],
  row: string[],
  used: Set<number>
): string {
  const lines: string[] = [];
  const width = Math.max(headers.length, row.length);
  for (let index = 0; index < width; index += 1) {
    if (used.has(index)) {
      continue;
    }
    const value = String(row[index] || '').trim();
    if (!value) {
      continue;
    }
    const label =
      String(headers[index] || '').trim() || 'Column ' + String(index + 1);
    lines.push(label + ': ' + value);
  }
  return lines.join('\n').slice(0, 5000);
}

export function missingColumnMessage(missing: ImportColumn[]): string {
  if (missing.includes('Name') && missing.includes('Mobile')) {
    return 'Could not identify the Name and Mobile columns. Rename those columns to Name and Mobile in Google Sheets, then try again.';
  }
  const column = missing[0] || 'Name';
  return (
    'Could not identify the ' +
    column +
    ' column. Rename that column to ' +
    column +
    ' in Google Sheets, then try again.'
  );
}

export function planLeadImport(
  rows: string[][],
  existingMobiles: ReadonlySet<string>
): LeadImportPlan {
  const headers = (rows[0] || []).map((cell) => String(cell || '').trim());
  if (!headers.some(Boolean)) {
    return { outcome: 'needs_columns', missingColumns: ['Name', 'Mobile'] };
  }

  const samples = headers.map((_, index) => columnValues(rows, index));
  const nameScores = samples.map((values) => matchRatio(values, looksLikeName));
  const mobileScores = samples.map((values) =>
    matchRatio(values, (value) => Boolean(normalizeIndianMobile(value)))
  );

  let nameIndex = uniqueAlias(headers, NAME_ALIASES);
  let mobileIndex = uniqueAlias(headers, MOBILE_ALIASES);
  if (
    nameIndex !== null &&
    samples[nameIndex].length >= 3 &&
    nameScores[nameIndex] === 0
  ) {
    nameIndex = null;
  }
  if (
    mobileIndex !== null &&
    samples[mobileIndex].length >= 3 &&
    mobileScores[mobileIndex] === 0
  ) {
    mobileIndex = null;
  }
  if (nameIndex !== null && nameIndex === mobileIndex) {
    nameIndex = null;
    mobileIndex = null;
  }
  if (nameIndex === null) {
    nameIndex = pickColumn(nameScores, mobileIndex);
  }
  if (mobileIndex === null) {
    mobileIndex = pickColumn(mobileScores, nameIndex);
  }
  if (nameIndex !== null && nameIndex === mobileIndex) {
    nameIndex = null;
    mobileIndex = null;
  }

  const missingColumns: ImportColumn[] = [];
  if (nameIndex === null) {
    missingColumns.push('Name');
  }
  if (mobileIndex === null) {
    missingColumns.push('Mobile');
  }
  if (missingColumns.length || nameIndex === null || mobileIndex === null) {
    return { outcome: 'needs_columns', missingColumns };
  }

  const seen = new Set(existingMobiles);
  const leads: PlannedImportLead[] = [];
  let skippedCount = 0;
  let invalidCount = 0;
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    if (!row.some((cell) => String(cell || '').trim())) {
      continue;
    }
    const name = String(row[nameIndex] || '')
      .trim()
      .slice(0, 200);
    const mobile = normalizeIndianMobile(String(row[mobileIndex] || ''));
    if (!name || !mobile) {
      invalidCount += 1;
      continue;
    }
    if (seen.has(mobile)) {
      skippedCount += 1;
      continue;
    }
    seen.add(mobile);
    leads.push({
      name,
      mobile,
      notes: buildNotes(headers, row, new Set([nameIndex, mobileIndex]))
    });
  }

  return { outcome: 'ready', leads, skippedCount, invalidCount };
}

export function formatImportResult(result: {
  outcome: 'imported' | 'needs_columns';
  importedCount: number;
  skippedCount: number;
  invalidCount: number;
  missingColumns: ImportColumn[];
}): { message: string; needsRetry: boolean } {
  if (result.outcome === 'needs_columns') {
    return {
      message: missingColumnMessage(result.missingColumns),
      needsRetry: true
    };
  }
  if (
    result.importedCount === 0 &&
    result.skippedCount === 0 &&
    result.invalidCount === 0
  ) {
    return { message: 'No leads found in that sheet.', needsRetry: true };
  }

  const lines = [
    countLine(result.importedCount, 'lead imported', 'leads imported')
  ];
  if (result.skippedCount > 0) {
    lines.push(
      countLine(
        result.skippedCount,
        'existing lead skipped',
        'existing leads skipped'
      )
    );
  }
  if (result.invalidCount > 0) {
    lines.push(
      countLine(
        result.invalidCount,
        'row skipped because name or mobile was missing',
        'rows skipped because name or mobile was missing'
      )
    );
  }
  return { message: lines.join('\n'), needsRetry: false };
}

function countLine(count: number, singular: string, plural: string): string {
  return String(count) + ' ' + (count === 1 ? singular : plural);
}
