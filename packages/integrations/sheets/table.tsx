import { AppError } from '@aolt/core/errors';
import type {
  ResourceDefinition,
  ResourcePolicy,
  Actor
} from '@aolt/core/contracts';
import type { ResourceRecord, ResourceValue } from '@aolt/shared/contracts';

export type SheetRecord = {
  rowNumber: number;
  value: ResourceRecord;
};

export type SheetRowRecord = {
  rowNumber: number;
  values: string[];
  record: Record<string, string>;
};

export type SheetTable = {
  headers: string[];
  records: SheetRowRecord[];
};

export function parseJsonValue<T>(raw: string | undefined, fallback: T): T {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function columnLabel(number: number): string {
  let value = number;
  let label = '';
  while (value > 0) {
    const modulo = (value - 1) % 26;
    label = String.fromCharCode(65 + modulo) + label;
    value = Math.floor((value - modulo) / 26);
  }
  return label || 'A';
}

export function getTabName(range: string): string {
  const index = range.indexOf('!');
  return index >= 0 ? range.slice(0, index) : range;
}

export function findHeaderIndex(
  headers: string[],
  candidates: readonly string[]
): number {
  const indexByHeader = new Map<string, number>();
  headers.forEach((header, index) => {
    const normalized = header.toLowerCase();
    if (!indexByHeader.has(normalized)) {
      indexByHeader.set(normalized, index);
    }
  });
  for (const candidate of candidates) {
    const index = indexByHeader.get(candidate.toLowerCase());
    if (index !== undefined) {
      return index;
    }
  }
  return -1;
}

export function rowsToTable(rows: string[][]): SheetTable {
  if (!rows.length) {
    return { headers: [], records: [] };
  }

  const headers = (rows[0] || []).map((value) => String(value || '').trim());
  const records: SheetRowRecord[] = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const values = rows[rowIndex] || [];
    const record: Record<string, string> = {};
    let hasValue = false;

    for (let columnIndex = 0; columnIndex < headers.length; columnIndex += 1) {
      const header = headers[columnIndex];
      if (!header) {
        continue;
      }
      const value = String(values[columnIndex] || '').trim();
      hasValue ||= Boolean(value);
      record[header] = value;
    }

    if (hasValue) {
      records.push({ rowNumber: rowIndex + 1, values, record });
    }
  }

  return { headers, records };
}

export function rowsToConfigMap(rows: string[][]): Record<string, string> {
  const map: Record<string, string> = {};
  if (!rows.length) {
    return map;
  }

  const firstRow = rows[0] || [];
  const hasHeader =
    firstRow.length >= 2 &&
    String(firstRow[0] || '')
      .trim()
      .toLowerCase() === 'key';
  for (let index = hasHeader ? 1 : 0; index < rows.length; index += 1) {
    const [keyRaw = '', valueRaw = ''] = rows[index] || [];
    const key = String(keyRaw || '').trim();
    if (key) {
      map[key] = String(valueRaw || '');
    }
  }
  return map;
}

export function resolveHeaders(
  actual: readonly string[],
  definition: ResourceDefinition
): Map<string, number> {
  const byName = new Map(
    actual.map((header, index) => [String(header).trim().toLowerCase(), index])
  );
  const result = new Map<string, number>();
  for (const header of definition.headers) {
    const candidates = [header, ...(definition.aliases?.[header] || [])];
    const index = candidates
      .map((candidate) => byName.get(candidate.toLowerCase()))
      .find((candidate) => candidate !== undefined);
    if (index === undefined) {
      throw new AppError(
        'UPSTREAM_ERROR',
        'Sheet schema is missing required columns.',
        502,
        false,
        'sheet_schema'
      );
    }
    result.set(header, index);
  }
  return result;
}

export function parseRows(
  rows: string[][],
  definition: ResourceDefinition
): SheetRecord[] {
  if (!rows.length) return [];
  const columns = resolveHeaders(rows[0], definition);
  return rows.slice(1).flatMap((row, index) => {
    const value: ResourceValue = {};
    for (const header of definition.headers) {
      value[header] = String(row[columns.get(header)!] || '').trim();
    }
    if (!String(value[definition.idColumn] || '')) return [];
    return [
      {
        rowNumber: index + 2,
        value: definition.schema.parse(value) as ResourceRecord
      }
    ];
  });
}

export function toRow(
  headers: readonly string[],
  definition: ResourceDefinition,
  value: ResourceValue
): string[] {
  const columns = resolveHeaders(headers, definition);
  const row = Array<string>(headers.length).fill('');
  for (const header of definition.headers) {
    const raw = value[header];
    row[columns.get(header)!] = raw == null ? '' : String(raw);
  }
  return row;
}

export function canAccess(
  policy: ResourcePolicy,
  definition: ResourceDefinition,
  value: ResourceValue,
  actor: Actor
): boolean {
  if (policy === 'authenticated') return true;
  return (
    !!definition.ownerColumn &&
    String(value[definition.ownerColumn] || '').toLowerCase() ===
      actor.email.toLowerCase()
  );
}
