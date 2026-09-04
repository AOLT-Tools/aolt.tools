import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as XLSX from 'xlsx';
import { appManifest } from '@aolt/core/manifest';

const destination = resolve('docs/templates/app-sheets-template.xlsx');
mkdirSync(dirname(destination), { recursive: true });

const workbook = XLSX.utils.book_new();
for (const resource of appManifest.resources) {
  const rows = [
    [...resource.headers],
    ...(resource.seedRows || []).map((seed) =>
      resource.headers.map((header) => seed[header] ?? '')
    )
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), resource.sheet);
}
XLSX.utils.book_append_sheet(
  workbook,
  XLSX.utils.aoa_to_sheet([
    [...appManifest.allowedUsersHeaders],
    ['developer@example.com', 'Local Developer']
  ]),
  appManifest.allowedUsersSheet
);
XLSX.writeFile(workbook, destination);
console.log('Wrote ' + destination);
