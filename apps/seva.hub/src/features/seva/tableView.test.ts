import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UpdateLeadRequest } from '../../../shared/contracts/appContracts';
import { sevaWorkspace } from './sevaWorkspace';

function setup() {
  const updateLead = vi.fn(async (payload: UpdateLeadRequest) => ({
    lead: { id: payload.id, lastUpdated: '2026-11-17T10:00:00.000Z' }
  }));
  vi.stubGlobal('window', { appRuntime: { updateLead } });
  const app = sevaWorkspace();
  app.leadQueueView = 'table';
  app.statusOptions = ['Response', 'Connected', 'Call Back'];
  app.appConfig.programs = app.defaultPrograms;
  app.refreshProgramCaches();
  const lead = app.normalizeLead({
    id: 'test-lead',
    name: 'Aarav Sharma',
    status: 'Connected',
    notes: 'Original notes',
    wishlistPrograms: ['HP']
  });
  app.leads = [lead];
  return { app, lead, updateLead };
}

describe('table lead editor', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('discards changes made through shared pickers when the edit sheet is cancelled', async () => {
    const { app, lead, updateLead } = setup();
    app.openLeadEdit(lead, null);
    const draft = app.tableEditDraft!;
    app.openOptionSheet('status', draft);
    await app.applyOptionSelection('Call Back');
    app.openProgramEditor(draft);
    app.toggleProgramSelection('wishlist', 'DSN');
    app.applyProgramEditor();
    app.openFollowUpPicker(draft);
    app.followUpDraft = '2026-11-21T17:30';
    await app.applyFollowUpPicker();
    app.closeLeadEdit();
    await app.flushPendingSaves();

    expect(draft).toMatchObject({
      status: 'Call Back',
      wishlistPrograms: expect.arrayContaining(['HP', 'DSN']),
      followUp: '2026-11-21T17:30'
    });
    expect(lead).toMatchObject({
      status: 'Connected',
      wishlistPrograms: ['HP'],
      followUp: 'Follow-up'
    });
    expect(updateLead).not.toHaveBeenCalled();
  });

  it('validates and saves a corrected mobile number from the shared editor', async () => {
    const { app, lead, updateLead } = setup();
    app.leadQueueView = 'cards';
    app.openLeadEdit(lead, null);
    app.tableEditDraft!.mobile = '123';
    await app.saveTableLeadEdit();
    expect(app.tableEditError).toMatch(/valid 10-digit/);
    expect(updateLead).not.toHaveBeenCalled();
    app.tableEditDraft!.mobile = '+91 98765 43210';
    await app.saveTableLeadEdit();
    expect(updateLead).toHaveBeenCalledWith(
      expect.objectContaining({ mobile: '9876543210' })
    );
    expect(lead.mobile).toBe('9876543210');
    expect(lead._phoneDigits).toBe('9876543210');
  });

  it('keeps a failed draft available for retry and updates the shared record only after saving', async () => {
    const { app, lead, updateLead } = setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    updateLead.mockRejectedValueOnce(new Error('Unable to save the record.'));
    app.openLeadEdit(lead, null);
    app.tableEditDraft!.name = 'Aarav S.';
    app.tableEditDraft!.notes = 'Call after five';

    await app.saveTableLeadEdit();

    expect(lead.name).toBe('Aarav Sharma');
    expect(lead.notes).toBe('Original notes');
    expect(app.tableEditDraft?.notes).toBe('Call after five');
    expect(app.tableEditError).toMatch(/unable to save/i);

    await app.saveTableLeadEdit();

    expect(updateLead).toHaveBeenCalledTimes(2);
    expect(updateLead.mock.calls[1][0]).not.toHaveProperty('mobile');
    expect(app.tableEditDraft).toBeNull();
    expect(lead).toMatchObject({
      name: 'Aarav S.',
      notes: 'Call after five',
      _nameLower: 'aarav s.',
      isDirty: false,
      lastSavedAt: '2026-11-17T10:00:00.000Z'
    });
  });
});
