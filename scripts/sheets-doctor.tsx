import { appManifest } from '@aolt/core/manifest';
import { SheetsClient, type SheetTarget } from '@aolt/integrations/sheets/client';
import { columnLabel } from '@aolt/integrations/sheets/table';
import { loadLocalEnv } from './_env.js';

loadLocalEnv();
const fix = process.argv.includes('--fix');
const client = new SheetsClient();
let issues = 0;

type SheetPlan = {
  target: SheetTarget;
  title: string;
  headers: readonly string[];
  aliases?: Readonly<Record<string, readonly string[]>>;
};

const plans: SheetPlan[] = [
  ...appManifest.resources.map((resource) => ({
    target: 'data' as const,
    title: resource.sheet,
    headers: resource.headers,
    aliases: resource.aliases
  })),
  {
    target: 'access' as const,
    title: appManifest.allowedUsersSheet,
    headers: appManifest.allowedUsersHeaders
  }
];

const titleCache = new Map<SheetTarget, Set<string>>();

async function titles(target: SheetTarget) {
  let values = titleCache.get(target);
  if (!values) {
    values = await client.sheetTitles(target);
    titleCache.set(target, values);
  }
  return values;
}

for (const plan of plans) {
  const existingTitles = await titles(plan.target);
  if (!existingTitles.has(plan.title)) {
    issues += 1;
    console.warn('Missing sheet: ' + plan.title + ' (' + plan.target + ')');
    if (!fix) continue;
    await client.addSheet(plan.target, plan.title);
    existingTitles.add(plan.title);
    await client.writeRow(plan.target, plan.title + '!A1', [...plan.headers]);
    console.log('Created sheet and header: ' + plan.title);
    continue;
  }

  const rows = await client.read(plan.target, plan.title + '!1:1');
  const actual = (rows[0] || []).map((header) => header.trim());
  const normalized = new Set(actual.map((header) => header.toLowerCase()));
  const missing = plan.headers.filter((header) => {
    const candidates = [header, ...(plan.aliases?.[header] || [])];
    return !candidates.some((candidate) => normalized.has(candidate.toLowerCase()));
  });
  if (!missing.length) {
    console.log('Header OK: ' + plan.title);
    continue;
  }
  issues += 1;
  console.warn('Missing headers in ' + plan.title + ': ' + missing.join(', '));
  if (!fix) continue;
  if (!actual.some(Boolean)) {
    await client.writeRow(plan.target, plan.title + '!A1', [...plan.headers]);
  } else {
    await client.writeRow(
      plan.target,
      plan.title + '!' + columnLabel(actual.length + 1) + '1',
      [...missing]
    );
  }
  console.log('Repaired header: ' + plan.title);
}

console.log(
  'Sheets doctor complete. Issues: ' + issues + '. Fix mode: ' + (fix ? 'on' : 'off')
);
if (issues && !fix) process.exitCode = 1;
