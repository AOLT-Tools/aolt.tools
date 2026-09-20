import type { SearchSourceId } from './searchIntent.js';
import { aolSearchAdapter } from './sources/aolSearchAdapter.js';
import { vdsSearchAdapter } from './sources/vdsSearchAdapter.js';
import { vvmvpSearchAdapter } from './sources/vvmvpSearchAdapter.js';

export const SEARCH_SOURCE_ADAPTERS = [
  aolSearchAdapter,
  vvmvpSearchAdapter,
  vdsSearchAdapter
] as const;

export function adapterIdForSource(
  source: SearchSourceId
): 'aol' | 'vvmvp' | 'vds' {
  if (source === 'vvmvp' || source === 'vds') return source;
  return 'aol';
}

export function routeSources(source: SearchSourceId): SearchSourceId[] {
  return [adapterIdForSource(source)];
}
