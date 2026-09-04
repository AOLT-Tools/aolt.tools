import type { Lead as ContractLead } from '../../../shared/contracts/appContracts';
import type { SevaWorkspaceContext, CampaignType, Lead, LeadSnapshot } from './types';
import { toUserErrorMessage } from '../../services/apiClient';

type LeadInput = Omit<Partial<ContractLead>, 'wishlistPrograms' | 'donePrograms'> & {
  wishlistPrograms?: string | string[];
  donePrograms?: string | string[];
};

interface LeadSaveRequest {
  lead: Lead;
  snapshot: LeadSnapshot;
}

// At most one save runs at a time per lead; a save started while one is
// already in flight just replaces `pending` with the latest snapshot, and
// the in-flight save picks it up next. One volunteer editing <=50 leads at a
// time never needs more concurrency than that.
interface LeadSaveQueue {
  pending: LeadSaveRequest | null;
  running: Promise<boolean> | null;
}

const saveQueuesByContext = new WeakMap<object, Map<string, LeadSaveQueue>>();

function getSaveQueues(context: SevaWorkspaceContext): Map<string, LeadSaveQueue> {
  let queues = saveQueuesByContext.get(context);
  if (!queues) {
    queues = new Map<string, LeadSaveQueue>();
    saveQueuesByContext.set(context, queues);
  }
  return queues;
}

function cloneSnapshot(snapshot: LeadSnapshot): LeadSnapshot {
  return {
    ...snapshot,
    wishlistPrograms: [...snapshot.wishlistPrograms],
    donePrograms: [...snapshot.donePrograms]
  };
}

function snapshotsMatch(left: LeadSnapshot, right: LeadSnapshot): boolean {
  return (
    left.name === right.name &&
    left.quality === right.quality &&
    left.followUp === right.followUp &&
    left.status === right.status &&
    left.notes === right.notes &&
    left.wishlistPrograms.length === right.wishlistPrograms.length &&
    left.wishlistPrograms.every(
      (program, index) => program === right.wishlistPrograms[index]
    ) &&
    left.donePrograms.length === right.donePrograms.length &&
    left.donePrograms.every((program, index) => program === right.donePrograms[index])
  );
}

function toCampaignType(value: unknown, fallback: CampaignType): CampaignType {
  return value === 'Members' || value === 'Leads' ? value : fallback;
}

export function getLeadCompositeKey(lead: Pick<Lead, 'id'>): string {
  return lead.id;
}

async function drainLeadSaveQueue(
  context: SevaWorkspaceContext,
  queue: LeadSaveQueue
): Promise<boolean> {
  let latestSucceeded = true;

  while (queue.pending) {
    const request = queue.pending;
    queue.pending = null;

    try {
      const lastUpdated = await context.saveLead(request.lead, request.snapshot);
      latestSucceeded = true;

      // Only mark clean if no newer edit was queued while this save was in flight.
      if (!queue.pending) {
        request.lead._originalData = cloneSnapshot(request.snapshot);
        request.lead.lastUpdated = lastUpdated || 'Just now';
        request.lead.isDirty = !snapshotsMatch(
          context.createLeadSnapshot(request.lead),
          request.snapshot
        );
      }
    } catch (error) {
      console.error(error);
      context.authError = toUserErrorMessage(
        error,
        'Unable to save your changes. Please try again.'
      );
      latestSucceeded = false;
      request.lead.isDirty = true;
      if (!queue.pending) {
        request.lead.lastUpdated = 'Save failed';
      }
    }
  }

  return latestSucceeded;
}

export function createLeadLifecycleMethods() {
  return {
    createLeadSnapshot(this: SevaWorkspaceContext, lead: Lead): LeadSnapshot {
      return {
        name: lead.name || '',
        quality: lead.quality || '',
        followUp: lead.followUp || '',
        status: lead.status || '',
        notes: lead.notes || '',
        wishlistPrograms: this.normalizePrograms(lead.wishlistPrograms),
        donePrograms: this.normalizePrograms(lead.donePrograms)
      };
    },
    ensureLeadTracking(this: SevaWorkspaceContext, lead: Lead): void {
      if (!lead._originalData) {
        lead._originalData = this.createLeadSnapshot(lead);
      }
    },
    getLeadKey(this: SevaWorkspaceContext, lead: Lead): string {
      return getLeadCompositeKey(lead);
    },
    getLeadByKey(this: SevaWorkspaceContext, leadKey: string): Lead | null {
      return (
        (this.leads || []).find((item) => this.getLeadKey(item) === leadKey) || null
      );
    },
    activateCard(this: SevaWorkspaceContext, lead: Lead | null): void {
      if (!lead) {
        return;
      }
      const leadKey = this.getLeadKey(lead);
      if (this.activeCardId && this.activeCardId !== leadKey) {
        void this.autoSaveLeadByKey(this.activeCardId);
      }
      this.activeCardId = leadKey;
      this.ensureLeadTracking(lead);
    },
    markLeadDirty(this: SevaWorkspaceContext, lead: Lead | null): void {
      if (!lead) {
        return;
      }
      this.activateCard(lead);
      lead.isDirty = true;
    },
    markLeadFilterDirty(this: SevaWorkspaceContext, lead: Lead | null): void {
      if (!lead) {
        return;
      }
      this.normalizeLeadDerivedFields(lead);
      this.markLeadDirty(lead);
    },
    finishNameEditing(this: SevaWorkspaceContext, lead: Lead | null): void {
      if (!lead) {
        return;
      }
      lead.isEditingName = false;
      this.normalizeLeadDerivedFields(lead);
    },
    handleGlobalPointerDown(this: SevaWorkspaceContext, event: PointerEvent): void {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const cardElement = target.closest('[data-card-id]');
      if (!cardElement) {
        void this.autoSaveLeadByKey(this.activeCardId);
        return;
      }

      const clickedCardId = cardElement.getAttribute('data-card-id') || '';
      if (clickedCardId && this.activeCardId && this.activeCardId !== clickedCardId) {
        void this.autoSaveLeadByKey(this.activeCardId);
      }
    },
    async autoSaveLeadByKey(
      this: SevaWorkspaceContext,
      leadKey: string
    ): Promise<boolean> {
      if (!leadKey) {
        return true;
      }
      const lead = this.getLeadByKey(leadKey);
      if (!lead) {
        if (this.activeCardId === leadKey) {
          this.activeCardId = '';
        }
        return true;
      }
      if (lead.isDirty) {
        return this.commitLeadChanges(lead);
      }
      if (this.activeCardId === leadKey) {
        this.activeCardId = '';
      }
      return true;
    },
    async commitLeadChanges(
      this: SevaWorkspaceContext,
      lead: Lead | null
    ): Promise<boolean> {
      if (!lead) {
        return true;
      }

      this.ensureLeadTracking(lead);
      const leadKey = this.getLeadKey(lead);
      const queues = getSaveQueues(this);
      let queue = queues.get(leadKey);
      if (!queue) {
        queue = { pending: null, running: null };
        queues.set(leadKey, queue);
      }

      if (lead.isDirty) {
        queue.pending = { lead, snapshot: this.createLeadSnapshot(lead) };
      }

      if (!queue.running && queue.pending) {
        const running = drainLeadSaveQueue(this, queue);
        queue.running = running;
        void running.finally(() => {
          queue!.running = null;
          if (!queue!.pending) {
            queues.delete(leadKey);
          }
        });
      }

      const succeeded = queue.running ? await queue.running : !lead.isDirty;
      if (succeeded && !lead.isDirty && this.activeCardId === leadKey) {
        this.activeCardId = '';
      }
      return succeeded;
    },
    async flushPendingSaves(this: SevaWorkspaceContext): Promise<boolean> {
      for (;;) {
        const dirtyLeads = (this.leads || []).filter((lead: Lead) => lead.isDirty);
        const running = [...getSaveQueues(this).values()]
          .map((queue) => queue.running)
          .filter((promise): promise is Promise<boolean> => Boolean(promise));

        if (!dirtyLeads.length && !running.length) {
          return true;
        }

        const saveResults = await Promise.all([
          ...dirtyLeads.map((lead: Lead) => this.commitLeadChanges(lead)),
          ...running
        ]);
        if (saveResults.some((result) => !result)) {
          return false;
        }
      }
    },
    discardLeadChanges(this: SevaWorkspaceContext, lead: Lead | null): void {
      if (!lead) {
        return;
      }
      this.ensureLeadTracking(lead);
      const snapshot = lead._originalData || this.createLeadSnapshot(lead);
      const leadKey = this.getLeadKey(lead);
      const hasPendingSave = Boolean(getSaveQueues(this).get(leadKey)?.running);

      lead.name = snapshot.name;
      lead.quality = snapshot.quality;
      lead.followUp = snapshot.followUp;
      lead.status = snapshot.status;
      lead.notes = snapshot.notes;
      lead.wishlistPrograms = this.normalizePrograms(snapshot.wishlistPrograms);
      lead.donePrograms = this.normalizePrograms(snapshot.donePrograms);
      this.normalizeLeadDerivedFields(lead);
      lead.isEditingName = false;
      lead.isDirty = hasPendingSave;
      if (hasPendingSave) {
        void this.commitLeadChanges(lead);
      } else if (this.activeCardId === leadKey) {
        this.activeCardId = '';
      }
    },
    normalizeLead(this: SevaWorkspaceContext, lead: LeadInput): Lead {
      const campaignType = toCampaignType(lead.campaignType, this.campaignType);
      const normalizedLead = {
        id: String(lead.id || ''),
        mobile: String(lead.mobile || ''),
        name: String(lead.name || ''),
        quality: '',
        followUp: String(lead.followUp || ''),
        lastUpdated: String(lead.lastUpdated || 'Just now'),
        status: '',
        notes: String(lead.notes || ''),
        campaignId: String(lead.campaignId || this.selectedCampaignId),
        campaignType,
        assignedVolunteerEmail: String(lead.assignedVolunteerEmail || ''),
        wishlistPrograms: this.normalizePrograms(lead.wishlistPrograms),
        donePrograms: this.normalizePrograms(lead.donePrograms),
        programSummary: '✏️ Program',
        isEditingName: false,
        isDirty: false,
        _originalData: null,
        _nameLower: '',
        _phoneRawLower: '',
        _phoneDigits: '',
        _followUpDate: null,
        _followUpTs: null
      } satisfies Lead;
      const qualityPlaceholder = campaignType === 'Members' ? 'Engagement' : 'Quality';
      const incomingQuality = String(lead.quality || '');
      const incomingStatus = String(lead.status || '');
      normalizedLead.quality = incomingQuality.trim()
        ? incomingQuality
        : qualityPlaceholder;
      normalizedLead.status = incomingStatus.trim() ? incomingStatus : 'Response';
      normalizedLead.followUp = String(lead.followUp || 'Follow-up');
      this.normalizeLeadDerivedFields(normalizedLead);
      return normalizedLead;
    },
    normalizeLeadDerivedFields(this: SevaWorkspaceContext, lead: Lead): void {
      const contactMobile = String(lead.mobile || '');
      lead._nameLower = String(lead.name || '').toLowerCase();
      lead._phoneRawLower = contactMobile.toLowerCase();
      lead._phoneDigits = this.cleanPhone(contactMobile);
      lead._followUpDate = this.parseDate(lead.followUp);
      lead._followUpTs = lead._followUpDate
        ? this.getDateOnlyTimestampFromDate(lead._followUpDate)
        : null;
      this.refreshLeadProgramSummary(lead);
    }
  };
}
