import { loadLocalEnv } from '@aolt/core/local-env';

import { createOfficialSearchService } from '../lib/factory.js';
import { formatSearchResponse } from '../lib/presenter.js';

loadLocalEnv();

const args = process.argv.slice(2);
const json = args.includes('--json');
const query = args
  .filter((arg) => arg !== '--json')
  .join(' ')
  .trim();

if (!query) {
  console.log('Usage: pnpm search "HP near 560045 within 10km" [--json]');
  process.exitCode = 1;
} else {
  try {
    const response = await createOfficialSearchService().search(query);
    if (json) {
      console.log(JSON.stringify({ success: true, ...response }, null, 2));
    } else {
      console.log(formatSearchResponse(response));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
