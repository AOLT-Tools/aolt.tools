import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

for (const project of [
  'tsconfig.json',
  'apps/aol.guide/tsconfig.json',
  'apps/seva.hub/tsconfig.json'
]) {
  const result = spawnSync(
    process.execPath,
    [resolve('node_modules/typescript/bin/tsc'), '--noEmit', '-p', project],
    { stdio: 'inherit' }
  );
  if (result.status !== 0) process.exit(result.status || 1);
}
