import { loadLocalEnv } from '@aolt/core/local-env';

import { OfficialSearchService } from './searchService.js';

export function createOfficialSearchService(now?: Date): OfficialSearchService {
  loadLocalEnv({ override: false });
  return new OfficialSearchService({ now });
}
