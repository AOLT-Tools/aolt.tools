import type { Campaign } from '../../shared/contracts/appContracts.js';

export {
  columnLabel,
  findHeaderIndex,
  getTabName,
  parseJsonValue,
  rowsToConfigMap,
  rowsToTable,
  type SheetRowRecord,
  type SheetTable
} from '@aolt/integrations/sheets/table';

export function rowsToCampaigns(rows: string[][]): Campaign[] {
  if (!rows.length) {
    return [];
  }

  const headers = (rows[0] || []).map((value) =>
    String(value || '')
      .trim()
      .toLowerCase()
  );
  const idIndex = headers.indexOf('id');
  const nameIndex = headers.indexOf('name');
  const typeIndex = headers.indexOf('type');
  const messageIndex = headers.indexOf('message');
  const showDoneProgramsIndex = headers.indexOf('showdoneprograms');
  if (idIndex < 0 || nameIndex < 0 || typeIndex < 0) {
    return [];
  }

  const campaigns: Campaign[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const id = String(row[idIndex] || '').trim();
    const name = String(row[nameIndex] || '').trim();
    const type = String(row[typeIndex] || '').trim() as Campaign['type'];
    if (!id || !name || (type !== 'Leads' && type !== 'Members')) {
      continue;
    }

    const campaign: Campaign = { id, name, type };
    const message = String(row[messageIndex] || '').trim();
    if (message) {
      campaign.message = message;
    }
    if (showDoneProgramsIndex >= 0) {
      const flag = String(row[showDoneProgramsIndex] || '')
        .trim()
        .toLowerCase();
      if (flag === 'true' || flag === 'false') {
        campaign.showDonePrograms = flag === 'true';
      }
    }
    campaigns.push(campaign);
  }

  return campaigns;
}
