import { mergeLocalEnv, parseEnvFile } from '@aolt/core/local-env';

export function parseEnvText(text) {
  return parseEnvFile(text);
}

export function loadEnv(cwd = process.cwd()) {
  return mergeLocalEnv({ cwd });
}
