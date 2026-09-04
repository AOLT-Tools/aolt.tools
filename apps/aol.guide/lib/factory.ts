import { loadLocalEnv } from '@aolt/core/local-env';

import { readAolGuideConfig } from './config.js';
import { GeminiIntentParser } from './geminiIntentParser.js';
import {
  createPincodeCoordinateResolver,
  loadBundledPincodeCoordinateResolver
} from './pincodeCoordinates.js';
import { OfficialSearchService } from './searchService.js';

export function createOfficialSearchService(now?: Date): OfficialSearchService {
  loadLocalEnv({ override: false });
  const config = readAolGuideConfig();
  const nlpParser = config.geminiApiKey
    ? new GeminiIntentParser({
        apiKey: config.geminiApiKey,
        model: config.geminiModel,
        now
      })
    : undefined;

  return new OfficialSearchService({
    pincodeResolver: createPincodeCoordinateResolver({
      accessToken: config.mapboxAccessToken,
      localResolver: loadBundledPincodeCoordinateResolver()
    }),
    nlpParser,
    now
  });
}
