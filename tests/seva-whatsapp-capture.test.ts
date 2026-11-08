import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SHEET_LAYOUT } from '../apps/seva.hub/shared/contracts/sheetContract.mjs';
import { buildLeadShareMessage } from '../apps/seva.hub/shared/leadShare';

const sheets = vi.hoisted(() => ({
  read: vi.fn(),
  append: vi.fn(),
  update: vi.fn()
}));
vi.mock('../apps/seva.hub/server/sheets/client.js', () => ({
  readSheetValues: sheets.read,
  appendSheetRow: sheets.append,
  updateSheetValuesBatch: sheets.update
}));
vi.mock('../apps/seva.hub/server/sheets/layout.js', () => ({
  getSheetLayout: () => DEFAULT_SHEET_LAYOUT
}));

import {
  buildShareableLeadMessage,
  upsertLeadByMobileAndCampaign
} from '../apps/seva.hub/server/whatsapp/leadCaptureService';

const headers = [
  'id',
  'mobile',
  'name',
  'campaignId',
  'createdAt',
  'lastUpdated',
  'notes'
];
const campaign = {
  id: 'cmpLeads01AbcDefGhIJk',
  name: 'Current',
  type: 'Leads' as const
};
const parsed = {
  name: 'Captured Lead',
  mobile: '9000000093',
  course: 'HP',
  leadQuality: 'Hot',
  month: 'Nov',
  notes: 'Follow up',
  originalMessage: 'Captured Lead 9000000093 HP Hot Nov'
};

describe('WhatsApp capture creation timestamps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-08T07:00:00Z'));
    sheets.append.mockResolvedValue(undefined);
    sheets.update.mockResolvedValue(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('stores creation time for a new WhatsApp capture', async () => {
    sheets.read.mockResolvedValue([headers]);
    expect(
      await upsertLeadByMobileAndCampaign('volunteer@example.com', parsed, campaign)
    ).toEqual({ action: 'created' });
    expect(sheets.append).toHaveBeenCalledWith('data', 'Leads!A:G', [
      expect.any(String),
      parsed.mobile,
      parsed.name,
      campaign.id,
      '2026-11-08T07:00:00.000Z',
      '2026-11-08T07:00:00.000Z',
      parsed.notes
    ]);
  });

  it('preserves the original creation time when an existing capture is updated', async () => {
    sheets.read.mockResolvedValue([
      headers,
      [
        'leadTest01AbcDefGhIJK',
        parsed.mobile,
        'Old name',
        campaign.id,
        '2026-01-01T00:00:00Z',
        '2026-01-01T00:00:00Z',
        'Old note'
      ]
    ]);
    expect(
      await upsertLeadByMobileAndCampaign('volunteer@example.com', parsed, campaign)
    ).toEqual({ action: 'updated' });
    expect(sheets.append).not.toHaveBeenCalled();
    const updates = sheets.update.mock.calls[0][1] as { range: string }[];
    expect(updates.some((update) => update.range === 'Leads!E2')).toBe(false);
  });

  it('formats the WhatsApp reply using the same summary as the browser clipboard', () => {
    expect(buildShareableLeadMessage(parsed)).toBe(buildLeadShareMessage(parsed));
  });
});
