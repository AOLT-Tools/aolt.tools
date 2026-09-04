import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve('.');
const banned = [
  'react',
  'react-dom',
  'preact',
  'vue',
  'svelte',
  '@angular/core',
  'solid-js',
  'next',
  'nuxt',
  'astro'
];
const ignoredDirectories = new Set([
  '.vercel',
  '.vite',
  '.vite-temp',
  'dist',
  'node_modules'
]);

function files(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((entry) => {
    if (ignoredDirectories.has(entry)) return [];
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

function deployableEntries(app: 'aol.guide' | 'seva.hub'): string[] {
  const apiRoot = join(root, 'apps', app, 'api');
  return files(apiRoot)
    .filter((path) => ['.ts', '.js', '.mjs', '.cjs'].includes(extname(path)))
    .map((path) => relative(apiRoot, path).replaceAll('\\', '/'))
    .sort();
}

describe('architecture boundaries', () => {
  it('contains no prohibited frontend framework dependency or import', () => {
    for (const packageFile of [
      'package.json',
      'apps/aol.guide/package.json',
      'apps/seva.hub/package.json'
    ]) {
      const pkg = JSON.parse(readFileSync(join(root, packageFile), 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const name of banned) expect(dependencies).not.toHaveProperty(name);
    }

    const source = ['apps', 'packages', 'examples']
      .flatMap((directory) => files(join(root, directory)))
      .filter((path) => ['.ts', '.tsx', '.js', '.mjs'].includes(extname(path)))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    for (const name of banned) {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(source).not.toMatch(new RegExp('from\\s+[\'"]' + escapedName));
    }
  });

  it('has no root Vercel API surface', () => {
    expect(existsSync(join(root, 'api'))).toBe(false);
    expect(existsSync(join(root, 'vercel.json'))).toBe(false);
  });

  it('deploys only AOL Guide function entrypoints from the AOL Guide project', () => {
    expect(deployableEntries('aol.guide')).toEqual(['search.ts']);
  });

  it('deploys only Seva Hub function entrypoints from the Seva Hub project', () => {
    expect(deployableEntries('seva.hub')).toEqual([
      'auth.ts',
      'bootstrap.ts',
      'courses.ts',
      'health/sheets.ts',
      'leads.ts',
      'whatsapp/webhook.ts'
    ]);
  });

  it('keeps Seva Hub function helpers outside api', () => {
    expect(existsSync(join(root, 'apps/seva.hub/api/_lib'))).toBe(false);
    expect(existsSync(join(root, 'apps/seva.hub/server'))).toBe(true);
  });

  it('does not emit known server secret names into app browser bundles', () => {
    for (const app of ['aol.guide', 'seva.hub']) {
      const dist = join(root, 'apps', app, 'dist');
      if (!existsSync(dist)) continue;
      const bundle = files(dist)
        .filter((path) => ['.js', '.html', '.css'].includes(extname(path)))
        .map((path) => readFileSync(path, 'utf8'))
        .join('\n');
      for (const name of [
        'GOOGLE_CLIENT_SECRET',
        'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
        'META_APP_SECRET',
        'SESSION_SECRETS',
        'BLOB_READ_WRITE_TOKEN'
      ]) {
        expect(bundle).not.toContain(name);
      }
    }
  });
});
