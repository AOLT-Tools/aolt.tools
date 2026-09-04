import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../api/', import.meta.url));
const allowed = new Set(['search.ts']);
const files = walk(root)
  .map((file) => relative(root, file).replaceAll('\\', '/'))
  .sort();
const unexpected = files.filter(
  (file) => /\.(?:ts|js|mjs|cjs)$/.test(file) && !allowed.has(file)
);
if (unexpected.length) {
  console.error(
    'Unexpected deployable files under api/:\n' +
      unexpected.map((item) => '- ' + item).join('\n')
  );
  console.error('Move helpers outside api/. Only real Vercel Functions belong there.');
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
