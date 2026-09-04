import { appManifest } from '@aolt/core/manifest';
import { getServerEnv } from '@aolt/core/env';
import { VercelBlobStore } from '@aolt/integrations/blob/blob-store';
import { SheetsClient } from '@aolt/integrations/sheets/client';
import { parseRows } from '@aolt/integrations/sheets/table';
import { loadLocalEnv } from './_env.js';

loadLocalEnv();
const fix = process.argv.includes('--fix');
const client = new SheetsClient();
const blobStore = new VercelBlobStore();
const referenced = new Set<string>();

for (const resource of appManifest.resources) {
  if (!resource.headers.includes('attachmentPath')) continue;
  const rows = await client.read('data', resource.sheet + '!A:ZZ');
  for (const record of parseRows(rows, resource)) {
    const pathname = String(record.value.attachmentPath || '').trim();
    if (pathname) referenced.add(pathname);
  }
}

const prefix = getServerEnv().BLOB_NAMESPACE + '/uploads/';
const blobs = await blobStore.list(prefix);
const stored = new Set(blobs.map((blob) => blob.pathname));
const orphaned = blobs.filter((blob) => !referenced.has(blob.pathname));
const missing = [...referenced].filter((pathname) => !stored.has(pathname));

console.log('Referenced blobs: ' + referenced.size);
console.log('Stored blobs: ' + blobs.length);
console.log('Orphaned blobs: ' + orphaned.length);
console.log('Missing referenced blobs: ' + missing.length);

for (const blob of orphaned) {
  console.warn('Orphan: ' + blob.pathname);
  if (fix) await blobStore.delete(blob.pathname);
}
for (const pathname of missing) console.warn('Missing: ' + pathname);

if ((orphaned.length || missing.length) && !fix) process.exitCode = 1;
