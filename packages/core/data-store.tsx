export type DataStoreMode = 'mock' | 'sheets';

export type DataStoreResolverOptions<TStore> = {
  mode: () => DataStoreMode;
  sheets: () => TStore;
  mock: () => TStore | Promise<TStore>;
};

export function createDataStoreResolver<TStore>(
  options: DataStoreResolverOptions<TStore>
): () => Promise<TStore> {
  let hasSheetsStore = false;
  let sheetsStore: TStore;
  let mockStorePromise: Promise<TStore> | null = null;

  return async function getDataStore(): Promise<TStore> {
    if (options.mode() === 'sheets') {
      if (!hasSheetsStore) {
        sheetsStore = options.sheets();
        hasSheetsStore = true;
      }
      return sheetsStore;
    }

    if (!mockStorePromise) {
      mockStorePromise = Promise.resolve().then(() => options.mock());
    }
    return mockStorePromise;
  };
}
