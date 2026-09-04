import { DEFAULT_GEMINI_MODEL } from '@aolt/integrations/gemini/json';

export type AolGuideRuntimeConfig = {
  geminiApiKey: string;
  geminiModel: string;
  mapboxAccessToken: string;
};

export function readAolGuideConfig(
  env: NodeJS.ProcessEnv = process.env
): AolGuideRuntimeConfig {
  return {
    geminiApiKey: env.AOL_GUIDE_GEMINI_API_KEY || env.GEMINI_API_KEY || '',
    geminiModel: env.AOL_GUIDE_GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    mapboxAccessToken: env.AOL_GUIDE_MAPBOX_TOKEN || env.MAPBOX_ACCESS_TOKEN || ''
  };
}
