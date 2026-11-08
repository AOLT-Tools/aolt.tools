import { afterEach, describe, expect, it, vi } from 'vitest';
import { sevaWorkspace } from './sevaWorkspace';
import { MockLeadRepository } from '../../repositories/mock/mockLeadRepository';
import { mockBootstrapData } from '../../repositories/mock/mockData';
import { ApiClientError } from '../../services/apiClient';
import type { BootstrapResponse } from '../../../shared/contracts/appContracts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function setup() {
  const repository = new MockLeadRepository();
  const runtime = {
    getAuthenticatedUser: vi.fn(
      async () => mockBootstrapData.user as typeof mockBootstrapData.user | null
    ),
    loadBootstrap: vi.fn((id?: string | null, metadataOnly = false) =>
      repository.getBootstrap(id, metadataOnly)
    ),
    createLead: vi.fn((payload) => repository.createLead(payload)),
    signOut: vi.fn(async () => {})
  };
  vi.stubGlobal('navigator', {
    clipboard: { writeText: vi.fn(async () => {}) }
  });
  vi.stubGlobal('window', {
    appRuntime: runtime,
    location: {
      pathname: '/seva/add-lead',
      href: 'http://localhost/seva/add-lead'
    },
    history: { replaceState: vi.fn() }
  });
  return { app: sevaWorkspace(), runtime, repository };
}

describe('fast direct lead entry', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the form immediately, preserves typing during metadata loading, and does not fetch existing leads', async () => {
    const { app, runtime, repository } = setup();
    const metadata = deferred<BootstrapResponse>();
    runtime.loadBootstrap.mockImplementationOnce(() => metadata.promise);
    expect(app.isCreateRecordModalOpen).toBe(true);
    expect(app.isLeadEntryReady).toBe(false);
    const starting = app.initializeAuthenticatedSession();
    await vi.waitFor(() => expect(runtime.loadBootstrap).toHaveBeenCalledOnce());
    expect(runtime.loadBootstrap).toHaveBeenCalledWith('all', true);
    Object.assign(app.createRecordDraft, {
      name: 'Typed immediately',
      mobile: '9000000051',
      notes: 'Keep my draft'
    });
    await app.saveCreatedRecord();
    expect(runtime.createLead).not.toHaveBeenCalled();

    metadata.resolve(await repository.getBootstrap('all', true));
    await starting;
    expect(app.isLeadEntryReady).toBe(true);
    expect(app.createRecordDraft).toMatchObject({
      name: 'Typed immediately',
      mobile: '9000000051',
      notes: 'Keep my draft',
      campaignId: 'cmpLeads01AbcDefGhIJk'
    });
    expect(app.leads).toEqual([]);
    expect(app.isLoadingBootstrap).toBe(false);
    expect(runtime.loadBootstrap).toHaveBeenCalledOnce();
  });

  it('starts a nonblocking existing-leads request after save without losing the newly added lead', async () => {
    const { app, runtime, repository } = setup();
    await app.initializeAuthenticatedSession();
    const existing = deferred<BootstrapResponse>();
    runtime.loadBootstrap.mockImplementationOnce(() => existing.promise);
    Object.assign(app.createRecordDraft, {
      name: 'Saved first',
      mobile: '9000000052'
    });
    await app.saveCreatedRecord();
    expect(app.actionMessage).toBe('Lead added successfully.');
    expect(app.isCreateRecordModalOpen).toBe(false);
    expect(app.isLoadingBootstrap).toBe(false);
    expect(app.isLoadingExistingLeads).toBe(true);
    const savedId = app.leads[0].id;
    app.selectedFilter = 'hot';
    app.programFilter = 'HP';
    existing.resolve(await repository.getBootstrap('all'));
    await vi.waitFor(() => expect(app.isLoadingExistingLeads).toBe(false));
    expect(app.leads.filter((lead) => lead.id === savedId)).toHaveLength(1);
    expect(app.leads.some((lead) => lead.name === 'Aarav Sharma')).toBe(true);
    expect(app.selectedFilter).toBe('hot');
    expect(app.programFilter).toBe('HP');
  });

  it('isolates a failed background load from a second form and allows retry', async () => {
    const { app, runtime, repository } = setup();
    await app.initializeAuthenticatedSession();
    const existing = deferred<BootstrapResponse>();
    runtime.loadBootstrap.mockImplementationOnce(() => existing.promise);
    app.closeCreateRecord();
    app.openCreateRecord('Leads');
    app.createRecordDraft.name = 'Another draft';
    existing.reject(new Error('Slow sheet unavailable'));
    await vi.waitFor(() => expect(app.isLoadingExistingLeads).toBe(false));
    expect(app.createRecordDraft.name).toBe('Another draft');
    expect(app.isCreateRecordModalOpen).toBe(true);
    expect(app.authError).toBe('');
    expect(app.existingLeadsError).toContain('Unable to load existing leads');
    await app.loadExistingLeadsInBackground();
    expect(app.existingLeadsError).toBe('');
    expect(app.leads).toHaveLength((await repository.getBootstrap('all')).leads.length);
    expect(app.createRecordDraft.name).toBe('Another draft');
  });

  it('retries metadata without clearing the draft or fetching the lead list', async () => {
    const { app, runtime } = setup();
    runtime.loadBootstrap.mockRejectedValueOnce(new Error('Metadata unavailable'));
    app.createRecordDraft.name = 'Retain on retry';
    await app.initializeAuthenticatedSession();
    expect(app.isLeadEntryReady).toBe(false);
    expect(app.isCreateRecordModalOpen).toBe(true);
    expect(app.authError).toBeTruthy();
    await app.openAuthenticatedWorkspace();
    expect(app.isLeadEntryReady).toBe(true);
    expect(app.createRecordDraft.name).toBe('Retain on retry');
    expect(runtime.loadBootstrap.mock.calls.every((call) => call[1] === true)).toBe(
      true
    );
  });

  it('does not reopen a cancelled form if metadata completes afterward', async () => {
    const { app, runtime, repository } = setup();
    const metadata = deferred<BootstrapResponse>();
    runtime.loadBootstrap.mockImplementationOnce(() => metadata.promise);
    const starting = app.initializeAuthenticatedSession();
    await vi.waitFor(() => expect(runtime.loadBootstrap).toHaveBeenCalledOnce());
    app.closeCreateRecord();
    metadata.resolve(await repository.getBootstrap('all', true));
    await starting;
    await vi.waitFor(() => expect(app.isLoadingExistingLeads).toBe(false));
    expect(app.isCreateRecordModalOpen).toBe(false);
    expect(app.isAddLeadRoute).toBe(false);
    expect(runtime.loadBootstrap).toHaveBeenCalledTimes(2);
    expect(app.leads).toHaveLength((await repository.getBootstrap('all')).leads.length);
  });

  it.each(['no-session', 'forbidden'] as const)(
    'prevents saving after %s',
    async (failure) => {
      const { app, runtime } = setup();
      if (failure === 'no-session')
        runtime.getAuthenticatedUser.mockResolvedValue(null);
      else
        runtime.loadBootstrap.mockRejectedValue(
          new ApiClientError('Denied', 403, 'FORBIDDEN')
        );
      await app.initializeAuthenticatedSession();
      expect(app.isCreateRecordModalOpen).toBe(false);
      expect(app.isVolunteerModalOpen).toBe(true);
      expect(app.isLeadEntryReady).toBe(false);
      Object.assign(app.createRecordDraft, {
        name: 'Must not save',
        mobile: '9000000053'
      });
      await app.saveCreatedRecord();
      expect(runtime.createLead).not.toHaveBeenCalled();
      if (failure === 'no-session')
        expect(runtime.loadBootstrap).not.toHaveBeenCalled();
    }
  );

  it('discards a stale background snapshot when another lead is added during the read', async () => {
    const { app, runtime, repository } = setup();
    await app.initializeAuthenticatedSession();
    const stale = await repository.getBootstrap('all');
    const existing = deferred<BootstrapResponse>();
    runtime.loadBootstrap.mockImplementationOnce(() => existing.promise);
    app.closeCreateRecord();
    app.openCreateRecord('Leads');
    Object.assign(app.createRecordDraft, {
      name: 'Added during read',
      mobile: '9000000054'
    });
    await app.saveCreatedRecord();
    existing.resolve(stale);
    await vi.waitFor(() => expect(runtime.loadBootstrap).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(app.isLoadingExistingLeads).toBe(false));
    expect(app.leads.filter((lead) => lead.name === 'Added during read')).toHaveLength(
      1
    );
    expect(app.leads.some((lead) => lead.name === 'Aarav Sharma')).toBe(true);
  });

  it('ignores an old list response after switching Seva', async () => {
    const { app, runtime, repository } = setup();
    await app.initializeAuthenticatedSession();
    const existing = deferred<BootstrapResponse>();
    runtime.loadBootstrap.mockImplementationOnce(() => existing.promise);
    app.closeCreateRecord();
    await app.loadBootstrap('cmpMembs01AbcDefGhIJK');
    existing.resolve(await repository.getBootstrap('all'));
    await Promise.resolve();
    expect(app.selectedCampaignId).toBe('cmpMembs01AbcDefGhIJK');
    expect(app.leads.every((lead) => lead.campaignType === 'Members')).toBe(true);
  });

  it('ignores a background response after signing out', async () => {
    const { app, runtime, repository } = setup();
    await app.initializeAuthenticatedSession();
    const existing = deferred<BootstrapResponse>();
    runtime.loadBootstrap.mockImplementationOnce(() => existing.promise);
    const loading = app.loadExistingLeadsInBackground();
    await app.signOutToLanding();
    existing.resolve(await repository.getBootstrap('all'));
    await loading;
    expect(app.authenticatedUser).toBeNull();
    expect(app.leads).toEqual([]);
    expect(app.campaigns).toEqual([]);
    expect(app.isCreateRecordModalOpen).toBe(false);
    expect(app.isLoadingExistingLeads).toBe(false);
  });
});
