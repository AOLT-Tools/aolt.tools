import { columnLabel, findHeaderIndex, getTabName } from '../sheets/table.js';

/** Add the timestamp header for new records without inventing historical dates. */
export async function ensureCreatedAtColumn(
  headers: string[],
  range: string,
  write: (updates: Array<{ range: string; values: string[][] }>) => Promise<void>
): Promise<number> {
  const existing = findHeaderIndex(headers, ['createdAt']);
  if (existing >= 0) return existing;
  const index = headers.length;
  await write([
    {
      range: `${getTabName(range)}!${columnLabel(index + 1)}1`,
      values: [['createdAt']]
    }
  ]);
  headers.push('createdAt');
  return index;
}
