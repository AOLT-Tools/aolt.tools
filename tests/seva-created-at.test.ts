import { describe, expect, it, vi } from 'vitest';
import { ensureCreatedAtColumn } from '../apps/seva.hub/server/leads/createdAt.js';

describe('lead timestamp schema compatibility', () => {
  it('uses an existing creation column without touching headers or old rows', async () => {
    const write = vi.fn();
    const headers = ['id', 'createdAt', 'mobile'];
    expect(await ensureCreatedAtColumn(headers, 'Leads!A:Z', write)).toBe(1);
    expect(write).not.toHaveBeenCalled();
  });

  it('adds a missing column after existing columns without backfilling dates', async () => {
    const write = vi.fn(async () => {});
    const headers = ['id', 'mobile'];
    expect(await ensureCreatedAtColumn(headers, 'Leads!A:Z', write)).toBe(2);
    expect(headers).toEqual(['id', 'mobile', 'createdAt']);
    expect(write).toHaveBeenCalledWith([
      { range: 'Leads!C1', values: [['createdAt']] }
    ]);
  });

  it('propagates header-write failures instead of pretending creation dates were persisted', async () => {
    const headers = ['id', 'mobile'];
    const write = vi.fn(async () => {
      throw new Error('Permission denied');
    });
    await expect(ensureCreatedAtColumn(headers, 'Leads!A:Z', write)).rejects.toThrow(
      'Permission denied'
    );
    expect(headers).toEqual(['id', 'mobile']);
  });
});
