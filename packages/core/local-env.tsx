import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_ENV_FILES = ['.env', '.env.local'] as const;

export type LocalEnvOptions = {
  cwd?: string;
  files?: readonly string[];
  override?: boolean;
};

export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const normalized = trimmed.startsWith('export ')
      ? trimmed.slice(7).trim()
      : trimmed;
    const equalsIndex = normalized.indexOf('=');
    if (equalsIndex <= 0) continue;
    const key = normalized.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    result[key] = parseEnvValue(normalized.slice(equalsIndex + 1).trim());
  }
  return result;
}

export function readLocalEnvFiles(
  options: LocalEnvOptions = {}
): Record<string, string> {
  const cwd = options.cwd ?? process.cwd();
  const result: Record<string, string> = {};
  for (const file of options.files || DEFAULT_ENV_FILES) {
    const path = resolve(cwd, file);
    if (!existsSync(path)) continue;
    Object.assign(result, parseEnvFile(readFileSync(path, 'utf8')));
  }
  return result;
}

export function loadLocalEnv(options: LocalEnvOptions = {}): void {
  const override = options.override ?? true;
  for (const [key, value] of Object.entries(readLocalEnvFiles(options))) {
    if (!override && process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
}

export function mergeLocalEnv(options: LocalEnvOptions = {}): NodeJS.ProcessEnv {
  return { ...readLocalEnvFiles(options), ...process.env };
}

function parseEnvValue(value: string): string {
  if (!value) return '';
  if (value.startsWith('"') && value.endsWith('"')) {
    return value
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  const commentIndex = value.indexOf(' #');
  return (commentIndex >= 0 ? value.slice(0, commentIndex) : value).trim();
}
