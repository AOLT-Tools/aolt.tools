import type { LeadRepository } from '../contracts';
import { nanoid } from 'nanoid';
import {
  AssignMembersRequestSchema,
  AssignMembersResponseSchema,
  BootstrapResponseSchema,
  CreateLeadRequestSchema,
  CreateLeadResponseSchema,
  DeleteLeadRequestSchema,
  DeleteLeadResponseSchema,
  UpdateLeadRequestSchema,
  UpdateLeadResponseSchema,
  MAX_MEMBERS_PER_VOLUNTEER,
  type AssignMembersRequest,
  type AssignMembersResponse,
  type BootstrapResponse,
  type CreateLeadRequest,
  type CreateLeadResponse,
  type DeleteLeadRequest,
  type DeleteLeadResponse,
  type Lead,
  type UpdateLeadRequest,
  type UpdateLeadResponse
} from '../../../shared/contracts/appContracts';
import { matchesMemberEngagement } from '../../../shared/memberAssignment';
import { mockBootstrapData } from './mockData';

export class MockLeadRepository implements LeadRepository {
  private leads: Lead[] = structuredClone(mockBootstrapData.leads);

  async getBootstrap(campaignId?: string | null): Promise<BootstrapResponse> {
    const selectedCampaignId = campaignId || mockBootstrapData.campaignId;
    const selectedCampaign = mockBootstrapData.config.campaigns.find(
      (campaign) => campaign.id === selectedCampaignId
    );

    if (!selectedCampaign) {
      throw new Error('Campaign not found: ' + selectedCampaignId);
    }

    const payload = {
      ...mockBootstrapData,
      campaignId: selectedCampaign.id,
      leads: this.leads
        .filter(
          (lead) =>
            lead.campaignId === selectedCampaign.id &&
            lead.campaignType === selectedCampaign.type
        )
        .map((lead) => ({ ...lead }))
    };

    return BootstrapResponseSchema.parse(payload);
  }

  async assignMembers(payload: AssignMembersRequest): Promise<AssignMembersResponse> {
    const parsed = AssignMembersRequestSchema.parse(payload);
    const campaign = mockBootstrapData.config.campaigns.find(
      (item) => item.id === parsed.campaignId
    );
    if (!campaign) {
      throw new Error('CAMPAIGN_NOT_FOUND');
    }
    if (campaign.type !== 'Members') {
      throw new Error('CAMPAIGN_TYPE_MISMATCH');
    }

    const volunteerEmail = mockBootstrapData.user.email.toLowerCase();
    const assignedCount = this.leads.filter(
      (lead) =>
        lead.campaignId === campaign.id &&
        lead.campaignType === 'Members' &&
        lead.assignedVolunteerEmail.toLowerCase() === volunteerEmail
    ).length;
    const availableCapacity = Math.max(0, MAX_MEMBERS_PER_VOLUNTEER - assignedCount);
    const selected = this.leads
      .filter(
        (lead) =>
          lead.campaignId === campaign.id &&
          lead.campaignType === 'Members' &&
          !lead.assignedVolunteerEmail.trim() &&
          matchesMemberEngagement(lead.quality, parsed.engagementLevels)
      )
      .slice(0, Math.min(parsed.count, availableCapacity));

    selected.forEach((lead) => {
      lead.assignedVolunteerEmail = volunteerEmail;
      lead.lastUpdated = 'Just now';
    });

    return AssignMembersResponseSchema.parse({
      success: true,
      requestedCount: parsed.count,
      assignedCount: selected.length,
      remainingCapacity: availableCapacity - selected.length,
      members: selected.map((lead) => ({ ...lead }))
    });
  }

  async updateLead(payload: UpdateLeadRequest): Promise<UpdateLeadResponse> {
    const parsed = UpdateLeadRequestSchema.parse(payload);
    if (
      parsed.assignedVolunteerEmail &&
      !(mockBootstrapData.config.allowedUsers || []).includes(
        parsed.assignedVolunteerEmail.toLowerCase()
      )
    ) {
      throw new Error('VOLUNTEER_NOT_ALLOWED');
    }
    const index = this.leads.findIndex(
      (lead) => lead.id === parsed.id && lead.campaignType === parsed.campaignType
    );

    if (index < 0) {
      throw new Error(
        'Lead not found for type: ' + parsed.campaignType + '/' + parsed.id
      );
    }

    this.leads[index] = {
      ...this.leads[index],
      ...parsed,
      lastUpdated: 'Just now'
    };

    return UpdateLeadResponseSchema.parse({
      success: true,
      lead: {
        id: parsed.id,
        lastUpdated: 'Just now'
      }
    });
  }

  async createLead(payload: CreateLeadRequest): Promise<CreateLeadResponse> {
    const parsed = CreateLeadRequestSchema.parse(payload);
    const lead: Lead = {
      id: nanoid(),
      mobile: parsed.mobile,
      name: parsed.name,
      quality: parsed.campaignType === 'Members' ? 'Engagement' : 'Quality',
      followUp: 'Follow-up',
      lastUpdated: 'Just now',
      status: 'Response',
      notes: parsed.notes || '',
      campaignId: parsed.campaignId,
      campaignType: parsed.campaignType,
      assignedVolunteerEmail: mockBootstrapData.user.email,
      wishlistPrograms: '',
      donePrograms: ''
    };
    this.leads.push(lead);
    return CreateLeadResponseSchema.parse({ success: true, lead });
  }

  async deleteLead(payload: DeleteLeadRequest): Promise<DeleteLeadResponse> {
    const parsed = DeleteLeadRequestSchema.parse(payload);
    const index = this.leads.findIndex(
      (lead) => lead.id === parsed.id && lead.campaignType === parsed.campaignType
    );
    if (index < 0) {
      throw new Error('Lead not found.');
    }
    this.leads.splice(index, 1);
    return DeleteLeadResponseSchema.parse({
      success: true,
      lead: { id: parsed.id }
    });
  }
}
