import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sevaWorkspace } from './sevaWorkspace';
import type { Lead } from './types';
import { sortLeads } from './sorting';
import { MockLeadRepository } from '../../repositories/mock/mockLeadRepository';
import { mockBootstrapData } from '../../repositories/mock/mockData';

const campaignId = 'cmpLeads01AbcDefGhIJk';
function environment(pathname = '/seva') {
  const repository = new MockLeadRepository();
  const memory = new Map<string, string>();
  const replaceState = vi.fn();
  const createLead = vi.fn((payload) => repository.createLead(payload));
  const writeText = vi.fn(async (_text: string) => {});
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  vi.stubGlobal('window', {
    location: { pathname, href: 'http://localhost' + pathname },
    history: { replaceState },
    localStorage: {
      getItem: (key: string) => memory.get(key),
      setItem: (key: string, value: string) => memory.set(key, value)
    },
    appRuntime: {
      createLead,
      getAuthenticatedUser: async () => mockBootstrapData.user,
      loadBootstrap: (id: string, metadataOnly = false) =>
        repository.getBootstrap(id, metadataOnly)
    }
  });
  const app = sevaWorkspace();
  // This fixture provides a preloaded, authorized form configuration.
  app.isLeadEntryReady = true;
  app.campaigns = structuredClone(mockBootstrapData.config.campaigns);
  app.selectedCampaignId = campaignId;
  app.volunteerEmail = mockBootstrapData.user.email;
  app.appConfig.programs = app.defaultPrograms;
  app.appConfig.programDisplayOrder = ['HP', 'DSN'];
  app.refreshProgramCaches();
  return { app, repository, createLead, writeText, replaceState, memory };
}

describe('lead sorting and shared add form', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['name-asc', ['a', 'b', 'c']],
    ['name-desc', ['c', 'b', 'a']],
    ['added-asc', ['b', 'a', 'c']],
    ['added-desc', ['a', 'b', 'c']],
    ['updated-asc', ['a', 'b', 'c']],
    ['updated-desc', ['b', 'a', 'c']]
  ])(
    'sorts %s without mutating the source or moving unknown dates ahead of known dates',
    (key, expected) => {
      const { app } = environment();
      const source = [
        app.normalizeLead({
          id: 'b',
          name: 'Beta',
          createdAt: '2026-11-01T00:00:00Z',
          lastUpdated: '2026-11-03T00:00:00Z'
        }),
        app.normalizeLead({
          id: 'a',
          name: 'alpha',
          createdAt: '2026-11-02T00:00:00Z',
          lastUpdated: '2026-11-02T00:00:00Z'
        }),
        app.normalizeLead({ id: 'c', name: 'Charlie', lastUpdated: 'Just now' })
      ];
      expect(sortLeads(source, key).map((lead) => lead.id)).toEqual(expected);
      expect(source.map((lead) => lead.id)).toEqual(['b', 'a', 'c']);
    }
  );

  it('sorts the entire filtered result before pagination and invalidates cached timestamps', () => {
    const { app } = environment();
    app.pageSize = 1;
    app.leads = [
      app.normalizeLead({
        id: 'a',
        name: 'Alpha',
        quality: 'Hot',
        lastUpdated: '2026-11-01T00:00:00Z'
      }),
      app.normalizeLead({
        id: 'b',
        name: 'Beta',
        quality: 'Warm',
        lastUpdated: '2026-11-02T00:00:00Z'
      }),
      app.normalizeLead({
        id: 'c',
        name: 'Charlie',
        quality: 'Hot',
        lastUpdated: '2026-11-03T00:00:00Z'
      })
    ];
    app.leadSort = 'name-desc';
    app.selectedFilter = 'hot';
    expect(app.visibleLeads().map((lead: Lead) => lead.id)).toEqual(['c']);
    expect(app.filteredLeads()).toHaveLength(2);
    app.loadMoreLeads();
    expect(app.visibleLeads().map((lead: Lead) => lead.id)).toEqual(['c', 'a']);
    app.leadSort = 'updated-desc';
    expect(app.visibleLeads()[0].id).toBe('c');
    app.leads[0].lastSavedAt = '2026-11-04T00:00:00Z';
    expect(app.visibleLeads()[0].id).toBe('a');
    app.leads[0].lastUpdated = 'Save failed';
    expect(app.visibleLeads()[0].id).toBe('a');
  });

  it('keeps the saved name order while editing and uses the new name after save', () => {
    const { app } = environment();
    const a = app.normalizeLead({ id: 'a', name: 'Alpha' });
    const b = app.normalizeLead({ id: 'b', name: 'Beta' });
    app.ensureLeadTracking(a);
    a.name = 'Zulu';
    expect(sortLeads([a, b], 'name-asc').map((lead) => lead.id)).toEqual(['a', 'b']);
    a._originalData = app.createLeadSnapshot(a);
    expect(sortLeads([a, b], 'name-asc').map((lead) => lead.id)).toEqual(['b', 'a']);
  });

  it('remembers sort per volunteer and does not switch order if pending saves fail', async () => {
    const { app } = environment();
    app.flushPendingSaves = vi.fn(async () => true);
    await app.selectLeadSort('name-desc');
    app.leadSort = 'added-desc';
    app.restoreLeadSort();
    expect(app.leadSort).toBe('name-desc');
    app.volunteerEmail = 'another@example.com';
    app.restoreLeadSort();
    expect(app.leadSort).toBe('added-desc');
    app.flushPendingSaves = vi.fn(async () => false);
    await app.selectLeadSort('name-asc');
    expect(app.leadSort).toBe('added-desc');
  });

  it('opens the same form from the deep URL after authentication and returns to /seva on cancel', async () => {
    const { app, replaceState } = environment('/seva/add-lead');
    await app.initializeAuthenticatedSession();
    expect(app.isCreateRecordModalOpen).toBe(true);
    expect(app.createRecordType).toBe('Leads');
    app.closeCreateRecord();
    expect(app.isCreateRecordModalOpen).toBe(false);
    expect(replaceState).toHaveBeenCalledWith({}, '', '/seva');
  });

  it('does not expose the deep-link form without an authenticated session', async () => {
    const { app } = environment('/seva/add-lead');
    window.appRuntime.getAuthenticatedUser = vi.fn(async () => null);
    await app.initializeAuthenticatedSession();
    expect(app.isVolunteerModalOpen).toBe(true);
    expect(app.isCreateRecordModalOpen).toBe(false);
  });

  it('saves optional multi-program and quality selections and copies the WhatsApp summary', async () => {
    const { app, repository, writeText } = environment('/seva/add-lead');
    app.openCreateRecord('Leads');
    app.createRecordDraft.name = 'New saved lead';
    app.createRecordDraft.mobile = '9000000011';
    app.createRecordDraft.notes = 'Call tomorrow';
    app.openProgramEditor();
    app.toggleProgramSelection('wishlist', 'HP');
    app.toggleProgramSelection('wishlist', 'DSN');
    app.applyProgramEditor();
    app.openOptionSheet('quality');
    await app.applyOptionSelection('Hot');
    await app.saveCreatedRecord();
    const saved = (await repository.getBootstrap('all')).leads.find(
      (lead) => lead.mobile === '9000000011'
    )!;
    expect(saved).toMatchObject({
      quality: 'Hot',
      wishlistPrograms: 'HP,DSN',
      notes: 'Call tomorrow'
    });
    expect(Number.isFinite(Date.parse(saved.createdAt!))).toBe(true);
    const copiedText = writeText.mock.calls[0][0];
    expect(copiedText).toContain(
      'Name: New saved lead\nMobile: 9000000011\nCourse: HP,DSN\nQuality: Hot'
    );
    expect(writeText).toHaveBeenCalledOnce();
    expect(copiedText).toContain('Notes: Call tomorrow');
    expect(app.isCreateRecordModalOpen).toBe(false);
  });

  it('keeps a saved lead successful when clipboard access fails without creating another record', async () => {
    const { app, createLead, writeText } = environment();
    writeText.mockRejectedValueOnce(new Error('Clipboard denied'));
    app.openCreateRecord('Leads');
    app.createRecordDraft.name = 'Optional fields empty';
    app.createRecordDraft.mobile = '9000000012';
    await app.saveCreatedRecord();
    expect(app.authError).toBe('');
    const copiedText = writeText.mock.calls[0][0];
    expect(copiedText).not.toContain('Course:');
    expect(copiedText).not.toContain('Quality:');
    expect(app.actionMessage).toBe(
      'Lead added successfully. Clipboard access was blocked.'
    );
    expect(app.isCreateRecordModalOpen).toBe(false);
    expect(writeText).toHaveBeenCalledOnce();
    expect(createLead).toHaveBeenCalledOnce();
  });

  it('does not copy a failed or duplicate lead creation', async () => {
    const { app, writeText, createLead } = environment();
    createLead.mockRejectedValueOnce(new Error('Create failed'));
    app.openCreateRecord('Leads');
    app.createRecordDraft.name = 'Duplicate';
    app.createRecordDraft.mobile = '9876543210';
    await app.saveCreatedRecord();
    expect(app.isCreateRecordModalOpen).toBe(true);
    expect(writeText).not.toHaveBeenCalled();
    expect(app.authError).toBeTruthy();
  });
});
