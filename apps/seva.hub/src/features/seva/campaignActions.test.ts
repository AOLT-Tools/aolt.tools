import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockLeadRepository } from '../../repositories/mock/mockLeadRepository';
import { sevaWorkspace } from './sevaWorkspace';

const MEMBERS_CAMPAIGN = {
  id: 'cmpMembs01AbcDefGhIJK',
  name: 'Member Reconnect',
  type: 'Members' as const
};

describe('current campaign actions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('flushes edits, refreshes the selected campaign, and keeps filters', async () => {
    const app = sevaWorkspace();
    app.volunteerEmail = 'volunteer@example.com';
    app.selectedCampaignId = MEMBERS_CAMPAIGN.id;
    app.selectedCampaign = MEMBERS_CAMPAIGN;
    app.campaignType = 'Members';
    app.selectedFilter = 'active';
    app.metricFilter = 'upcoming';
    app.searchQuery = 'Meera';
    app.programFilter = 'HP';
    app.filterOptions = [
      { id: 'all', label: 'All Members' },
      { id: 'active', label: 'Active' }
    ];
    app.flushPendingSaves = vi.fn(async () => true);
    app.loadBootstrap = vi.fn(async () => {
      app.selectedFilter = 'all';
      app.metricFilter = 'all';
      app.searchQuery = '';
      app.programFilter = '';
      return true;
    });

    await app.refreshCurrentCampaign();

    expect(app.flushPendingSaves).toHaveBeenCalledOnce();
    expect(app.loadBootstrap).toHaveBeenCalledWith(MEMBERS_CAMPAIGN.id);
    expect(app.selectedFilter).toBe('active');
    expect(app.metricFilter).toBe('upcoming');
    expect(app.searchQuery).toBe('Meera');
    expect(app.programFilter).toBe('HP');
    expect(app.actionMessage).toBe('Current Seva refreshed.');
    expect(app.isCampaignRefreshing).toBe(false);
  });

  it('keeps current records visible when a refresh fails', async () => {
    vi.stubGlobal('window', {
      appRuntime: {
        loadBootstrap: vi.fn(async () => {
          throw new Error('Refresh failed');
        })
      }
    });
    const app = sevaWorkspace();
    app.volunteerEmail = 'volunteer@example.com';
    app.selectedCampaignId = MEMBERS_CAMPAIGN.id;
    app.selectedCampaign = MEMBERS_CAMPAIGN;
    app.campaigns = [MEMBERS_CAMPAIGN];
    app.appConfig.campaigns = app.campaigns;
    app.campaignType = 'Members';
    const currentLeads = [
      app.normalizeLead({
        id: 'member-existing',
        name: 'Existing member',
        campaignId: MEMBERS_CAMPAIGN.id,
        campaignType: 'Members'
      })
    ];
    app.leads = currentLeads;
    app.flushPendingSaves = vi.fn(async () => true);

    await app.refreshCurrentCampaign();

    expect(app.leads).toBe(currentLeads);
    expect(app.authError).toBe('Unable to load Seva data. Please try again.');
    expect(app.actionMessage).toBe('');
  });

  it('requests member assignment and preserves the returned Sheet order', async () => {
    const assignMembers = vi.fn(async () => ({
      success: true as const,
      requestedCount: 2,
      assignedCount: 2,
      remainingCapacity: 97,
      members: [
        {
          id: 'member-newest',
          name: 'Newest member',
          quality: 'Active',
          campaignId: MEMBERS_CAMPAIGN.id,
          campaignType: 'Members' as const,
          assignedVolunteerEmail: 'volunteer@example.com'
        },
        {
          id: 'member-next',
          name: 'Next member',
          quality: 'Active',
          campaignId: MEMBERS_CAMPAIGN.id,
          campaignType: 'Members' as const,
          assignedVolunteerEmail: 'volunteer@example.com'
        }
      ]
    }));
    vi.stubGlobal('window', { appRuntime: { assignMembers } });

    const app = sevaWorkspace();
    app.volunteerEmail = 'volunteer@example.com';
    app.selectedCampaignId = MEMBERS_CAMPAIGN.id;
    app.selectedCampaign = MEMBERS_CAMPAIGN;
    app.campaignType = 'Members';
    app.qualityOptions = [
      { value: 'Active', label: 'Active' },
      { value: 'Occasional', label: 'Occasional' },
      { value: 'Engagement', label: 'Engagement' }
    ];
    app.leads = [
      app.normalizeLead({
        id: 'member-existing',
        name: 'Existing member',
        campaignId: MEMBERS_CAMPAIGN.id,
        campaignType: 'Members',
        assignedVolunteerEmail: 'volunteer@example.com'
      })
    ];
    app.flushPendingSaves = vi.fn(async () => true);
    app.isFabOpen = true;

    app.openAssignMembersModal();
    expect(app.isAssignMembersModalOpen).toBe(true);
    expect(app.isFabOpen).toBe(false);
    expect(app.getMemberAssignmentEngagementOptions()).toEqual([
      { value: 'Active', label: 'Active' },
      { value: 'Occasional', label: 'Occasional' }
    ]);
    expect(app.assignMembersDraft.engagementLevels).toEqual(['Active', 'Occasional']);
    app.assignMembersDraft.count = 2;
    app.toggleMemberAssignmentEngagement('Occasional');
    app.toggleMemberAssignmentEngagement('Occasional');

    await app.submitMemberAssignment();

    expect(assignMembers).toHaveBeenCalledWith({
      campaignId: MEMBERS_CAMPAIGN.id,
      count: 2,
      engagementLevels: []
    });
    expect(app.leads.map((member) => member.id)).toEqual([
      'member-newest',
      'member-next',
      'member-existing'
    ]);
    expect(app.isAssignMembersModalOpen).toBe(false);
    expect(app.actionMessage).toBe('2 members assigned to you.');
  });

  it('supports self-assignment in local mock mode', async () => {
    const repository = new MockLeadRepository();

    const response = await repository.assignMembers({
      campaignId: MEMBERS_CAMPAIGN.id,
      count: 1,
      engagementLevels: ['Active']
    });
    const refreshed = await repository.getBootstrap(MEMBERS_CAMPAIGN.id);

    expect(response.members.map((member) => member.id)).toEqual([
      'memberNew01AbcDefGhIJK'
    ]);
    expect(
      refreshed.leads.find((member) => member.id === 'memberNew01AbcDefGhIJK')
        ?.assignedVolunteerEmail
    ).toBe('volunteer@example.com');
  });
});
