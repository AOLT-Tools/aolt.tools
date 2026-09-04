import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

loadLocalEnv();

const RESOURCE_ID = '5c2f62fe-5afa-4119-a499-fec9d604d5bd';
const DEFAULT_API_KEY = '579b464db66ec23bdd000001cdc3b564546246a772a26393094f5645';
const apiKey = process.env.DATA_GOV_IN_API_KEY || DEFAULT_API_KEY;
const sourceUrl =
  'https://api.data.gov.in/resource/' +
  RESOURCE_ID +
  '?api-key=' +
  encodeURIComponent(apiKey) +
  '&offset=0&limit=all&format=csv';
const outputUrl = new URL('../data/pincodes.json', import.meta.url);
const outputPath = fileURLToPath(outputUrl);

const response = await fetch(sourceUrl, {
  headers: { accept: 'text/csv' }
});

if (!response.ok) {
  throw new Error('Data.gov.in PIN-code download failed with HTTP ' + response.status);
}

const csv = await response.text();
const rows = parseCsv(csv);
const [header = [], ...body] = rows;
const index = new Map(
  header.map((name, position) => [name.trim().toLowerCase(), position])
);
const groups = new Map();

for (const row of body) {
  const pincode = read(row, index, 'pincode').match(/\b[1-9]\d{5}\b/)?.[0] || '';
  const latitude = Number(read(row, index, 'latitude'));
  const longitude = Number(read(row, index, 'longitude'));
  if (
    !pincode ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    continue;
  }

  const current = groups.get(pincode) || {
    latitude: 0,
    longitude: 0,
    count: 0,
    cities: new Map(),
    states: new Map()
  };
  current.latitude += latitude;
  current.longitude += longitude;
  current.count += 1;
  addCount(current.cities, read(row, index, 'district'));
  addCount(current.states, read(row, index, 'statename'));
  groups.set(pincode, current);
}

const records = [...groups.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([pincode, group]) => [
    pincode,
    round(group.latitude / group.count),
    round(group.longitude / group.count),
    mostCommon(group.cities),
    mostCommon(group.states)
  ]);

const payload = {
  source: {
    name: 'All India Pincode Directory till last month',
    organization: 'Ministry of Communications, Department of Posts',
    url:
      'https://api.data.gov.in/resource/' +
      RESOURCE_ID +
      '?api-key=API_KEY&offset=0&limit=all&format=csv',
    license: 'Government Open Data License - India',
    license_url: 'https://www.data.gov.in/Godl',
    generated_at: new Date().toISOString()
  },
  records
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log(
  'Wrote ' +
    records.length +
    ' PIN-code coordinates to ' +
    outputPath.replace(process.cwd() + '/', '')
);

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function read(row, index, name) {
  return String(row[index.get(name)] || '').trim();
}

function addCount(map, value) {
  const normalized = value.trim();
  if (!normalized || normalized.toUpperCase() === 'NA') return;
  map.set(normalized, (map.get(normalized) || 0) + 1);
}

function mostCommon(map) {
  return (
    [...map.entries()].sort(
      ([leftValue, leftCount], [rightValue, rightCount]) =>
        rightCount - leftCount || leftValue.localeCompare(rightValue)
    )[0]?.[0] || ''
  );
}

function round(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function loadLocalEnv() {
  for (const file of ['.env', '.env.local']) {
    const path = resolve(file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match) continue;
      const key = match[1];
      const rawValue = match[2].trim();
      process.env[key] = rawValue.replace(/^"(.*)"$/, '$1').replace(/\\n/g, '\n');
    }
  }
}
