import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSheetsStore } from '../apps/seva.hub/server/sheets/store';
import { DEFAULT_SHEET_LAYOUT } from '../apps/seva.hub/shared/contracts/sheetContract.mjs';
import { mockBootstrapData } from '../apps/seva.hub/src/repositories/mock/mockData';
import { MockLeadRepository } from '../apps/seva.hub/src/repositories/mock/mockLeadRepository';
import {
  createLeadForUser,
  getBootstrapForUser,
  updateLeadForUser
} from '../apps/seva.hub/server/storage/mockStore';
import { withVolunteerTransferNote } from '../apps/seva.hub/shared/leadTransfer';

const user = mockBootstrapData.user;
const campaignId = mockBootstrapData.campaignId;
const recipient = 'other-volunteer@example.com';
const timestamp = '2026-11-08T07:00:00.000Z';
const newLead = {
  name: 'New test lead',
  mobile: '9000000091',
  campaignId,
  campaignType: 'Leads' as const,
  notes: 'Call tomorrow',
  quality: 'Hot',
  wishlistPrograms: 'HP,DSN'
};
const headers = [
  'id',
  'mobile',
  'name',
  'quality',
  'followUp',
  'lastUpdated',
  'status',
  'notes',
  'campaignId',
  'campaignType',
  'assignedVolunteerEmail',
  'wishlistPrograms',
  'donePrograms',
  'createdAt'
];

function fixture(includeCreatedAt = true, allowed = true) {
  const columns = includeCreatedAt ? [...headers] : headers.slice(0, -1);
  const row: Record<string, string> = {
    ...newLead,
    id: 'leadTest01AbcDefGhIJK',
    createdAt: '2026-01-01T00:00:00Z',
    assignedVolunteerEmail: user.email
  };
  const readSheetValues = vi.fn(async (target: string, range: string) =>
    target === 'access'
      ? [
          ['email', 'name'],
          ...(allowed
            ? [
                [user.email, 'Current Volunteer'],
                [recipient, 'Next Volunteer']
              ]
            : [])
        ]
      : range.startsWith('Leads!')
        ? [columns, columns.map((column) => row[column] || '')]
        : []
  );
  const updateSheetValuesBatch = vi.fn(
    async (
      _target: string,
      _updates: readonly { range: string; values: string[][] }[]
    ) => {}
  );
  const appendSheetRow = vi.fn(
    async (_target: string, _range: string, _row: string[]) => {}
  );
  const appendSheetRows = vi.fn(
    async (_target: string, _range: string, _rows: string[][]) => {}
  );
  const store = createSheetsStore({
    getSheetLayout: () => DEFAULT_SHEET_LAYOUT,
    readSheetValues,
    readSheetValuesBatch: async () => [
      [
        ['key', 'value'],
        ['id', mockBootstrapData.config.id],
        ['campaignId', campaignId]
      ],
      [
        ['id', 'name', 'type'],
        [campaignId, 'Current', 'Leads']
      ]
    ],
    updateSheetValuesBatch,
    appendSheetRow,
    appendSheetRows,
    now: () => new Date(timestamp)
  });
  return {
    store,
    readSheetValues,
    updateSheetValuesBatch,
    appendSheetRow,
    appendSheetRows
  };
}

afterEach(() => vi.restoreAllMocks());

describe('Seva Hub storage enhancements', () => {
  it.each(['all', campaignId])(
    'loads metadata for %s without reading any lead or member rows',
    async (scope) => {
      const f = fixture();
      const result = await f.store.getBootstrapForAuthorizedUser(
        user,
        scope,
        undefined,
        true
      );
      expect(result).toMatchObject({
        allowed: true,
        value: { campaignId: scope, leads: [] }
      });
      expect(
        f.readSheetValues.mock.calls.every(([target]) => target === 'access')
      ).toBe(true);
    }
  );

  it('still checks access before returning metadata', async () => {
    const f = fixture(true, false);
    expect(
      await f.store.getBootstrapForAuthorizedUser(user, 'all', undefined, true)
    ).toEqual({ allowed: false });
  });

  it('adds a missing creation header and stores creation time, programs and quality', async () => {
    const f = fixture(false);
    const result = await f.store.createLeadForAuthorizedUser(user, newLead);
    expect(result).toMatchObject({
      allowed: true,
      value: {
        lead: { createdAt: timestamp, quality: 'Hot', wishlistPrograms: 'HP,DSN' }
      }
    });
    expect(f.updateSheetValuesBatch).toHaveBeenCalledWith(
      'data',
      [{ range: 'Leads!N1', values: [['createdAt']] }],
      expect.anything()
    );
    const row = f.appendSheetRow.mock.calls[0][2];
    expect(row[13]).toBe(timestamp);
    expect(row[11]).toBe('HP,DSN');
  });

  it('records a transfer above existing notes without changing creation time or resending stale fields', async () => {
    const f = fixture();
    await f.store.updateLeadForAuthorizedUser(user, {
      id: 'leadTest01AbcDefGhIJK',
      campaignId,
      campaignType: 'Leads',
      assignedVolunteerEmail: recipient
    });
    const updates = f.updateSheetValuesBatch.mock.calls[0][1];
    expect(updates).toContainEqual({
      range: 'Leads!H2',
      values: [
        [
          'Transferred from Current Volunteer to Next Volunteer on 8 Nov 2026, 12:30 pm IST.\nCall tomorrow'
        ]
      ]
    });
    expect(updates.some((update) => update.range === 'Leads!N2')).toBe(false);
    expect(updates.some((update) => update.range === 'Leads!C2')).toBe(false);
  });

  it('timestamps imported leads too', async () => {
    const f = fixture(false);
    const result = await f.store.importLeadsForAuthorizedUser(user, {
      campaignId,
      rows: [
        ['Name', 'Mobile'],
        ['Imported Lead', '9000000092']
      ]
    });
    expect(result).toMatchObject({
      allowed: true,
      value: { importedCount: 1, leads: [{ createdAt: timestamp }] }
    });
    expect(f.appendSheetRows.mock.calls[0][2][0][13]).toBe(timestamp);
  });

  it('does not add notes for the same or absent recipient and retains earlier handoffs', () => {
    const volunteers = [
      { email: user.email, name: 'Current' },
      { email: recipient, name: 'Next' }
    ];
    const notes = withVolunteerTransferNote(
      'Original',
      user.email,
      recipient,
      volunteers,
      timestamp
    );
    expect(
      withVolunteerTransferNote(
        notes,
        recipient,
        recipient.toUpperCase(),
        volunteers,
        timestamp
      )
    ).toBe(notes);
    expect(
      withVolunteerTransferNote(notes, recipient, undefined, volunteers, timestamp)
    ).toBe(notes);
    expect(
      withVolunteerTransferNote(notes, recipient, user.email, volunteers, timestamp)
    ).toContain('\n' + notes);
  });

  it('keeps browser mock creation dates immutable and writes transfer history', async () => {
    const repository = new MockLeadRepository();
    const { lead } = await repository.createLead(newLead);
    await repository.updateLead({
      id: lead.id,
      campaignId,
      campaignType: 'Leads',
      assignedVolunteerEmail: recipient
    });
    const saved = (await repository.getBootstrap('all')).leads.find(
      (item) => item.id === lead.id
    )!;
    expect(saved.createdAt).toBe(lead.createdAt);
    expect(saved.notes).toContain('Transferred from ');
    expect(saved.notes).toContain('\nCall tomorrow');
    expect((await repository.getBootstrap('all', true)).leads).toEqual([]);
  });

  it('keeps server mock creation dates immutable and writes transfer history', async () => {
    const { lead } = await createLeadForUser(user, newLead);
    await updateLeadForUser(user, {
      id: lead.id,
      campaignId,
      campaignType: 'Leads',
      assignedVolunteerEmail: recipient
    });
    const saved = (
      await getBootstrapForUser({ ...user, email: recipient }, campaignId)
    ).leads.find((item) => item.id === lead.id)!;
    expect(saved.createdAt).toBe(lead.createdAt);
    expect(saved.notes).toContain('Transferred from ');
    expect(saved.notes).toContain('\nCall tomorrow');
    expect((await getBootstrapForUser(user, 'all', true)).leads).toEqual([]);
  });
});
