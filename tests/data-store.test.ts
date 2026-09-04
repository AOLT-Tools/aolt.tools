import { describe, expect, it, vi } from 'vitest';
import { createDataStoreResolver } from '@aolt/core/data-store';

describe('data store resolver', () => {
  it('caches the sheets store instance', async () => {
    const sheets = vi.fn(() => ({ mode: 'sheets' }));
    const getStore = createDataStoreResolver({
      mode: () => 'sheets',
      sheets,
      mock: () => ({ mode: 'mock' })
    });

    await expect(getStore()).resolves.toEqual({ mode: 'sheets' });
    await expect(getStore()).resolves.toEqual({ mode: 'sheets' });
    expect(sheets).toHaveBeenCalledTimes(1);
  });

  it('caches the async mock store promise', async () => {
    const mock = vi.fn(async () => ({ mode: 'mock' }));
    const getStore = createDataStoreResolver({
      mode: () => 'mock',
      sheets: () => ({ mode: 'sheets' }),
      mock
    });

    await Promise.all([getStore(), getStore(), getStore()]);
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
