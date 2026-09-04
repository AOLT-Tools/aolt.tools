import {
  MAX_MEMBERS_PER_VOLUNTEER,
  type UpdateLeadRequest
} from '../../../shared/contracts/appContracts';
import type {
  Campaign,
  CampaignType,
  Lead,
  OptionItem,
  SevaWorkspaceContext
} from './types';
import { toUserErrorMessage } from '../../services/apiClient';
import { normalizeIndianMobile } from '@aolt/core/normalization';

const CARD_LONG_PRESS_MS = 500;
const CARD_MOVE_TOLERANCE_PX = 10;

function getSelectedRecords(context: SevaWorkspaceContext): Lead[] {
  return context.leads.filter((lead) => context.selectedIds.has(lead.id));
}

function getBulkFailureMessage(
  results: PromiseSettledResult<unknown>[],
  succeededCount: number,
  partialMessage: string,
  failureMessage: string
): string {
  if (succeededCount > 0) {
    return partialMessage;
  }
  const firstFailure = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );
  return toUserErrorMessage(firstFailure?.reason, failureMessage);
}

async function runSequentialLeadRequests(
  records: Lead[],
  run: (lead: Lead) => Promise<unknown>
): Promise<PromiseSettledResult<unknown>[]> {
  const results: PromiseSettledResult<unknown>[] = [];
  for (const lead of records) {
    try {
      const value = await run(lead);
      results.push({ status: 'fulfilled', value });
    } catch (reason) {
      results.push({ status: 'rejected', reason });
    }
  }
  return results;
}

function getAllowedVolunteers(context: SevaWorkspaceContext) {
  const configured = context.appConfig.volunteers || [];
  if (configured.length) {
    return configured.map((volunteer) => ({
      email: volunteer.email.trim().toLowerCase(),
      name: volunteer.name.trim()
    }));
  }
  return [...new Set(context.appConfig.allowedUsers || [])].map((email) => ({
    email: String(email || '')
      .trim()
      .toLowerCase(),
    name: String(email || '').split('@')[0] || 'Volunteer'
  }));
}

function getMemberAssignmentEngagementValues(context: SevaWorkspaceContext): string[] {
  const options = context.getMemberAssignmentEngagementOptions() as OptionItem[];
  return options.map((option) => option.value).filter(Boolean);
}

function toUpdateRequest(
  context: SevaWorkspaceContext,
  lead: Lead,
  campaign: Campaign
): UpdateLeadRequest {
  const snapshot = context.createLeadSnapshot(lead);
  return {
    id: lead.id,
    name: snapshot.name,
    status: snapshot.status,
    quality: snapshot.quality,
    followUp: snapshot.followUp,
    notes: snapshot.notes,
    campaignId: campaign.id,
    campaignType: campaign.type,
    wishlistPrograms: context.getProgramListForSave(snapshot.wishlistPrograms),
    donePrograms: context.getProgramListForSave(snapshot.donePrograms)
  };
}

function getMoveCampaignDestinations(context: SevaWorkspaceContext): Campaign[] {
  if (context.campaignType === 'Members') {
    return context.campaigns.filter((campaign) => campaign.type === 'Leads');
  }

  return context.campaigns.filter(
    (campaign) =>
      campaign.type === context.campaignType &&
      campaign.id !== context.selectedCampaignId
  );
}

function isMoveCampaignAllowed(
  context: SevaWorkspaceContext,
  campaign: Campaign | undefined
): campaign is Campaign {
  if (!campaign) {
    return false;
  }
  if (context.campaignType === 'Members') {
    return campaign.type === 'Leads';
  }
  return (
    campaign.type === context.campaignType && campaign.id !== context.selectedCampaignId
  );
}

export function createRecordActionMethods() {
  return {
    selectedCount(this: SevaWorkspaceContext): number {
      return this.selectedIds.size;
    },
    isSelectionMode(this: SevaWorkspaceContext): boolean {
      return this.selectedIds.size > 0;
    },
    isLeadSelected(this: SevaWorkspaceContext, lead: Lead): boolean {
      return this.selectedIds.has(lead.id);
    },
    toggleLeadSelection(this: SevaWorkspaceContext, lead: Lead): void {
      const next = new Set(this.selectedIds);
      if (next.has(lead.id)) {
        next.delete(lead.id);
      } else {
        next.add(lead.id);
      }
      this.selectedIds = next;
      this.isFabOpen = false;
    },
    clearSelection(this: SevaWorkspaceContext): void {
      this.selectedIds = new Set<string>();
      this.cancelCardLongPress();
    },
    handleCardPointerDown(
      this: SevaWorkspaceContext,
      event: PointerEvent,
      lead: Lead
    ): void {
      if (event.button !== 0 || this.isBulkActionPending) {
        return;
      }
      this.suppressCardClickLeadId = '';
      if (!this.isSelectionMode()) {
        this.activateCard(lead);
      }
      this.cancelCardLongPress();
      this.cardLongPressStart = { x: event.clientX, y: event.clientY };
      this.cardLongPressTimer = setTimeout(() => {
        this.cardLongPressTimer = null;
        this.suppressCardClickLeadId = lead.id;
        if (!this.selectedIds.has(lead.id)) {
          this.toggleLeadSelection(lead);
        }
        window.getSelection?.()?.removeAllRanges();
      }, CARD_LONG_PRESS_MS);
    },
    handleCardPointerMove(this: SevaWorkspaceContext, event: PointerEvent): void {
      if (!this.cardLongPressStart) {
        return;
      }
      const movedX = Math.abs(event.clientX - this.cardLongPressStart.x);
      const movedY = Math.abs(event.clientY - this.cardLongPressStart.y);
      if (movedX > CARD_MOVE_TOLERANCE_PX || movedY > CARD_MOVE_TOLERANCE_PX) {
        this.cancelCardLongPress();
      }
    },
    cancelCardLongPress(this: SevaWorkspaceContext): void {
      if (this.cardLongPressTimer) {
        clearTimeout(this.cardLongPressTimer);
      }
      this.cardLongPressTimer = null;
      this.cardLongPressStart = null;
    },
    handleCardClick(this: SevaWorkspaceContext, event: MouseEvent, lead: Lead): void {
      this.cancelCardLongPress();
      if (this.suppressCardClickLeadId === lead.id) {
        this.suppressCardClickLeadId = '';
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.toggleLeadSelection(lead);
        return;
      }
      if (!this.isSelectionMode()) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      this.toggleLeadSelection(lead);
    },
    openMoveCampaignSheet(this: SevaWorkspaceContext): void {
      const destinations = getMoveCampaignDestinations(this);
      if (!destinations.length) {
        this.authError =
          this.campaignType === 'Members'
            ? 'No leads Seva is available for these members.'
            : 'No other Seva is available for these records.';
        return;
      }
      this.optionSheetMode = 'moveCampaign';
      this.optionSheetTitle =
        (this.campaignType === 'Members' ? 'Copy ' : 'Move ') +
        String(this.selectedCount()) +
        ' selected';
      this.optionSheetOptions = destinations.map((campaign: Campaign): OptionItem => ({
        value: campaign.id,
        label: campaign.name
      }));
      this.currentOptionValue = '';
      this.activeOptionLead = null;
      this.isOptionSheetOpen = true;
    },
    openReassignVolunteerSheet(this: SevaWorkspaceContext): void {
      const assignedEmails = new Set(
        getSelectedRecords(this).map((lead) =>
          lead.assignedVolunteerEmail.trim().toLowerCase()
        )
      );
      const volunteers = getAllowedVolunteers(this).filter(
        (volunteer) => !assignedEmails.has(volunteer.email)
      );
      if (!volunteers.length) {
        this.authError = 'No other volunteers are available in the allowed list.';
        return;
      }
      this.optionSheetMode = 'reassignVolunteer';
      this.optionSheetTitle = 'Reassign ' + String(this.selectedCount()) + ' selected';
      this.optionSheetOptions = volunteers
        .map((volunteer) => ({
          value: volunteer.email,
          label: volunteer.name
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
      this.currentOptionValue = '';
      this.activeOptionLead = null;
      this.isOptionSheetOpen = true;
    },
    async moveSelectedRecords(
      this: SevaWorkspaceContext,
      campaignId: string
    ): Promise<void> {
      const campaign = this.campaigns.find((item) => item.id === campaignId);
      const records = getSelectedRecords(this);
      if (!isMoveCampaignAllowed(this, campaign) || !records.length) {
        return;
      }
      this.isBulkActionPending = true;
      this.authError = '';
      this.actionMessage = '';
      try {
        if (!(await this.flushPendingSaves())) {
          this.authError =
            this.campaignType === 'Members'
              ? 'Save pending edits before copying these members.'
              : 'Save pending edits before moving these records.';
          return;
        }
        const results =
          this.campaignType === 'Members'
            ? await runSequentialLeadRequests(records, (lead) =>
                window.appRuntime.createLead({
                  name: lead.name,
                  mobile: normalizeIndianMobile(lead.mobile),
                  notes: lead.notes,
                  campaignId: campaign.id,
                  campaignType: 'Leads'
                })
              )
            : await runSequentialLeadRequests(records, (lead) =>
                window.appRuntime.updateLead(toUpdateRequest(this, lead, campaign))
              );
        const movedIds = new Set(
          records
            .filter((_, index) => results[index].status === 'fulfilled')
            .map((lead) => lead.id)
        );
        if (this.campaignType !== 'Members') {
          this.leads = this.leads.filter((lead) => !movedIds.has(lead.id));
          if (movedIds.has(this.activeCardId)) {
            this.activeCardId = '';
          }
        }
        this.selectedIds = new Set(
          [...this.selectedIds].filter((id) => !movedIds.has(id))
        );
        if (results.some((result) => result.status === 'rejected')) {
          this.authError = getBulkFailureMessage(
            results,
            movedIds.size,
            this.campaignType === 'Members'
              ? 'Some members could not be copied. The remaining members stay selected.'
              : 'Some records could not be moved. The remaining records stay selected.',
            this.campaignType === 'Members'
              ? 'Unable to copy the selected members. Please try again.'
              : 'Unable to move the selected records. Please try again.'
          );
        } else {
          const movedNoun =
            this.campaignType === 'Members'
              ? movedIds.size === 1
                ? 'member'
                : 'members'
              : movedIds.size === 1
                ? 'record'
                : 'records';
          this.actionMessage =
            String(movedIds.size) +
            ' ' +
            movedNoun +
            (this.campaignType === 'Members' ? ' copied to ' : ' moved to ') +
            campaign.name +
            '.';
          this.clearSelection();
        }
      } finally {
        this.isBulkActionPending = false;
      }
    },
    async deleteSelectedRecords(this: SevaWorkspaceContext): Promise<void> {
      const records = getSelectedRecords(this);
      if (!records.length) {
        return;
      }
      if (this.campaignType === 'Members') {
        this.authError = 'Members cannot be deleted from this view.';
        return;
      }
      const noun = records.length === 1 ? 'record' : 'records';
      if (!window.confirm('Delete ' + records.length + ' selected ' + noun + '?')) {
        return;
      }
      this.isBulkActionPending = true;
      this.authError = '';
      this.actionMessage = '';
      try {
        if (!(await this.flushPendingSaves())) {
          this.authError = 'Save pending edits before deleting these records.';
          return;
        }
        const results = await runSequentialLeadRequests(records, (lead) =>
          window.appRuntime.deleteLead({
            id: lead.id,
            campaignType: lead.campaignType
          })
        );
        const deletedIds = new Set(
          records
            .filter((_, index) => results[index].status === 'fulfilled')
            .map((lead) => lead.id)
        );
        this.leads = this.leads.filter((lead) => !deletedIds.has(lead.id));
        if (deletedIds.has(this.activeCardId)) {
          this.activeCardId = '';
        }
        this.selectedIds = new Set(
          [...this.selectedIds].filter((id) => !deletedIds.has(id))
        );
        if (results.some((result) => result.status === 'rejected')) {
          this.authError = getBulkFailureMessage(
            results,
            deletedIds.size,
            'Some records could not be deleted. The remaining records stay selected.',
            'Unable to delete the selected records. Please try again.'
          );
        } else {
          const deletedNoun = deletedIds.size === 1 ? 'record' : 'records';
          this.actionMessage =
            String(deletedIds.size) + ' ' + deletedNoun + ' deleted.';
          this.clearSelection();
        }
      } finally {
        this.isBulkActionPending = false;
      }
    },
    async reassignSelectedRecords(
      this: SevaWorkspaceContext,
      volunteerEmail: string
    ): Promise<void> {
      const normalizedEmail = String(volunteerEmail || '')
        .trim()
        .toLowerCase();
      const records = getSelectedRecords(this);
      const campaign = this.campaigns.find(
        (item) => item.id === this.selectedCampaignId
      );
      if (
        !records.length ||
        !campaign ||
        !getAllowedVolunteers(this).some(
          (volunteer) => volunteer.email === normalizedEmail
        )
      ) {
        this.authError = 'Select a volunteer from the allowed list.';
        return;
      }

      this.isBulkActionPending = true;
      this.authError = '';
      this.actionMessage = '';
      try {
        if (!(await this.flushPendingSaves())) {
          this.authError = 'Save pending edits before reassigning these records.';
          return;
        }
        const results = await runSequentialLeadRequests(records, (lead) =>
          window.appRuntime.updateLead({
            ...toUpdateRequest(this, lead, campaign),
            assignedVolunteerEmail: normalizedEmail
          })
        );
        const reassignedIds = new Set(
          records
            .filter((_, index) => results[index].status === 'fulfilled')
            .map((lead) => lead.id)
        );
        records.forEach((lead) => {
          if (reassignedIds.has(lead.id)) {
            lead.assignedVolunteerEmail = normalizedEmail;
          }
        });
        if (normalizedEmail !== this.volunteerEmail.toLowerCase()) {
          this.leads = this.leads.filter((lead) => !reassignedIds.has(lead.id));
          if (reassignedIds.has(this.activeCardId)) {
            this.activeCardId = '';
          }
        }
        this.selectedIds = new Set(
          [...this.selectedIds].filter((id) => !reassignedIds.has(id))
        );
        if (results.some((result) => result.status === 'rejected')) {
          this.authError = getBulkFailureMessage(
            results,
            reassignedIds.size,
            'Some records could not be reassigned. The remaining records stay selected.',
            'Unable to reassign the selected records. Please try again.'
          );
        } else {
          const volunteer = getAllowedVolunteers(this).find(
            (item) => item.email === normalizedEmail
          );
          const reassignedNoun = reassignedIds.size === 1 ? 'record' : 'records';
          this.actionMessage =
            String(reassignedIds.size) +
            ' ' +
            reassignedNoun +
            ' reassigned to ' +
            (volunteer?.name || normalizedEmail) +
            '.';
          this.clearSelection();
        }
      } finally {
        this.isBulkActionPending = false;
      }
    },
    memberAssignmentRemainingCapacity(this: SevaWorkspaceContext): number {
      if (this.campaignType !== 'Members') {
        return 0;
      }
      return Math.max(0, MAX_MEMBERS_PER_VOLUNTEER - this.leads.length);
    },
    getMemberAssignmentEngagementOptions(this: SevaWorkspaceContext): OptionItem[] {
      const placeholder = this.getQualityFieldLabel();
      const options = (this.qualityOptions || [])
        .filter((item) => item.value !== placeholder)
        .map((item) => ({ value: item.value, label: item.label }));
      return options;
    },
    isMemberAssignmentEngagementSelected(
      this: SevaWorkspaceContext,
      value: string
    ): boolean {
      const current = this.assignMembersDraft.engagementLevels || [];
      if (!current.length) {
        return getMemberAssignmentEngagementValues(this).includes(value);
      }
      return current.includes(value);
    },
    toggleMemberAssignmentEngagement(this: SevaWorkspaceContext, value: string): void {
      const allValues = getMemberAssignmentEngagementValues(this);
      if (!value || !allValues.includes(value)) {
        return;
      }
      const current = this.assignMembersDraft.engagementLevels.length
        ? this.assignMembersDraft.engagementLevels
        : allValues;
      if (current.includes(value)) {
        const next = current.filter((item) => item !== value);
        this.assignMembersDraft.engagementLevels = next.length ? next : allValues;
        return;
      }
      this.assignMembersDraft.engagementLevels = [...current, value];
    },
    openAssignMembersModal(this: SevaWorkspaceContext): void {
      if (this.campaignType !== 'Members' || !this.selectedCampaignId) {
        return;
      }
      const remainingCapacity = this.memberAssignmentRemainingCapacity();
      if (!remainingCapacity) {
        this.actionMessage = 'You already have 100 members in this Seva campaign.';
        return;
      }
      this.assignMembersDraft = {
        count: Math.min(10, remainingCapacity),
        engagementLevels: getMemberAssignmentEngagementValues(this)
      };
      this.authError = '';
      this.actionMessage = '';
      this.isFabOpen = false;
      this.isAssignMembersModalOpen = true;
    },
    closeAssignMembersModal(this: SevaWorkspaceContext): void {
      if (!this.isAssigningMembers) {
        this.isAssignMembersModalOpen = false;
      }
    },
    async submitMemberAssignment(this: SevaWorkspaceContext): Promise<void> {
      const count = Number(this.assignMembersDraft.count);
      if (
        this.campaignType !== 'Members' ||
        !this.selectedCampaignId ||
        !Number.isInteger(count) ||
        count < 1 ||
        count > MAX_MEMBERS_PER_VOLUNTEER
      ) {
        this.authError = 'Enter a member count between 1 and 100.';
        return;
      }

      this.isAssigningMembers = true;
      this.authError = '';
      this.actionMessage = '';
      try {
        if (!(await this.flushPendingSaves())) {
          this.authError = 'Save pending edits before assigning additional members.';
          return;
        }
        const selectedEngagementLevels = this.assignMembersDraft.engagementLevels || [];
        const allEngagementLevels = getMemberAssignmentEngagementValues(this);
        const hasAllEngagementLevels =
          allEngagementLevels.length > 0 &&
          allEngagementLevels.every((level) =>
            selectedEngagementLevels.includes(level)
          );
        const response = await window.appRuntime.assignMembers({
          campaignId: this.selectedCampaignId,
          count,
          engagementLevels: hasAllEngagementLevels ? [] : selectedEngagementLevels
        });
        const existingIds = new Set(this.leads.map((lead) => lead.id));
        const assignedMembers = response.members
          .filter((member) => !existingIds.has(member.id))
          .map((member) => this.normalizeLead(member));
        this.leads = [...assignedMembers, ...this.leads];
        this.isAssignMembersModalOpen = false;

        if (!response.assignedCount) {
          this.actionMessage = response.remainingCapacity
            ? 'No unassigned members match that engagement level.'
            : 'You already have 100 members in this Seva campaign.';
          return;
        }

        const noun = response.assignedCount === 1 ? 'member' : 'members';
        this.actionMessage =
          response.assignedCount === response.requestedCount
            ? String(response.assignedCount) + ' ' + noun + ' assigned to you.'
            : String(response.assignedCount) +
              ' of ' +
              String(response.requestedCount) +
              ' requested members assigned to you.';
      } catch (error) {
        this.authError = toUserErrorMessage(
          error,
          'Unable to assign members. Please try again.'
        );
      } finally {
        this.isAssigningMembers = false;
      }
    },
    getCreateCampaigns(
      this: SevaWorkspaceContext,
      type: CampaignType = this.createRecordType
    ): Campaign[] {
      return this.campaigns.filter((campaign) => campaign.type === type);
    },
    openCreateRecord(this: SevaWorkspaceContext, type: CampaignType): void {
      const campaigns = this.getCreateCampaigns(type);
      if (!campaigns.length) {
        this.authError =
          'No ' + type.toLowerCase() + ' Seva is available for this record.';
        return;
      }
      const preferred = campaigns.find(
        (campaign: Campaign) => campaign.id === this.selectedCampaignId
      );
      this.createRecordType = type;
      this.createRecordDraft = {
        name: '',
        mobile: '',
        notes: '',
        campaignId: (preferred || campaigns[0])?.id || ''
      };
      this.isFabOpen = false;
      this.isCreateRecordModalOpen = true;
    },
    closeCreateRecord(this: SevaWorkspaceContext): void {
      if (!this.isCreateRecordSaving) {
        this.isCreateRecordModalOpen = false;
      }
    },
    async saveCreatedRecord(this: SevaWorkspaceContext): Promise<void> {
      const name = this.createRecordDraft.name.trim();
      const mobile = normalizeIndianMobile(this.createRecordDraft.mobile);
      if (!name || !mobile || !this.createRecordDraft.campaignId) {
        this.authError =
          this.createRecordDraft.mobile.trim() && !mobile
            ? 'Enter a valid 10-digit Indian mobile number.'
            : 'Name, mobile, and destination Seva are required.';
        return;
      }
      this.isCreateRecordSaving = true;
      this.authError = '';
      this.actionMessage = '';
      try {
        const response = await window.appRuntime.createLead({
          name,
          mobile,
          notes: this.createRecordDraft.notes.trim(),
          campaignId: this.createRecordDraft.campaignId,
          campaignType: this.createRecordType
        });
        if (response.lead.campaignId === this.selectedCampaignId) {
          this.leads = [this.normalizeLead(response.lead), ...this.leads];
        }
        this.isCreateRecordModalOpen = false;
        this.actionMessage =
          (this.createRecordType === 'Members' ? 'Member' : 'Lead') +
          ' added successfully.';
      } catch (error) {
        this.authError = toUserErrorMessage(
          error,
          'Unable to add the record. Please try again.'
        );
      } finally {
        this.isCreateRecordSaving = false;
      }
    }
  };
}
