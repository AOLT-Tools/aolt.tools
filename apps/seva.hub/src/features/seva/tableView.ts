import { normalizeIndianMobile } from '@aolt/core/normalization';
import { DEFAULT_QUALITY_META_MAP } from '../../config/campaignDefaults';
import type { Lead, LeadQueueView, SevaWorkspaceContext } from './types';

const TABLE_QUALITY_ICONS: Record<string, string> = {
  Hot: '🔥',
  Warm: '☀️',
  Cold: '❄️',
  Active: '⚡',
  Occasional: '🕒',
  Inactive: '⏸️',
  Shifted: '↪️'
};

function viewStorageKey(email: string): string {
  return 'sevaHub.leadQueueView.' + email.trim().toLowerCase();
}

export function createTableViewMethods() {
  return {
    restoreLeadQueueView(this: SevaWorkspaceContext): void {
      this.leadQueueView = 'cards';
      try {
        if (
          window.localStorage?.getItem(viewStorageKey(this.volunteerEmail)) === 'table'
        ) {
          this.leadQueueView = 'table';
        }
      } catch {
        // The queue is usable without browser storage.
      }
    },
    async selectLeadQueueView(
      this: SevaWorkspaceContext,
      view: LeadQueueView
    ): Promise<void> {
      if (view === this.leadQueueView || !(await this.flushPendingSaves())) return;
      this.leadQueueView = view;
      this.resetTableInteraction();
      this.cancelCardLongPress();
      try {
        window.localStorage?.setItem(viewStorageKey(this.volunteerEmail), view);
      } catch {
        // Keep the current preference for this session.
      }
    },
    resetTableInteraction(this: SevaWorkspaceContext): void {
      this.highlightedLeadId = '';
      this.expandedLeadNotes = new Set();
    },
    handleTableLeadClick(
      this: SevaWorkspaceContext,
      event: MouseEvent,
      lead: Lead
    ): void {
      this.handleCardClick(event, lead);
      if (!event.defaultPrevented && !this.isSelectionMode()) {
        this.highlightedLeadId = this.getLeadKey(lead);
      }
    },
    visibleLeadsWithNotes(this: SevaWorkspaceContext): Lead[] {
      return this.visibleLeads().filter((lead: Lead) => lead.notes.trim());
    },
    hasVisibleLeadNotes(this: SevaWorkspaceContext): boolean {
      return this.visibleLeadsWithNotes().length > 0;
    },
    isLeadNoteExpanded(this: SevaWorkspaceContext, lead: Lead): boolean {
      return this.expandedLeadNotes.has(this.getLeadKey(lead));
    },
    toggleLeadNotes(this: SevaWorkspaceContext, lead: Lead): void {
      const key = this.getLeadKey(lead);
      const next = new Set(this.expandedLeadNotes);
      if (!lead.notes.trim() || next.has(key)) next.delete(key);
      else next.add(key);
      this.expandedLeadNotes = next;
    },
    areAllVisibleNotesExpanded(this: SevaWorkspaceContext): boolean {
      const leads = this.visibleLeadsWithNotes() as Lead[];
      return leads.length > 0 && leads.every((lead) => this.isLeadNoteExpanded(lead));
    },
    toggleAllVisibleNotes(this: SevaWorkspaceContext): void {
      const leads = this.visibleLeadsWithNotes() as Lead[];
      const collapse = leads.every((lead) => this.isLeadNoteExpanded(lead));
      const next = new Set(this.expandedLeadNotes);
      for (const lead of leads) {
        const key = this.getLeadKey(lead);
        if (collapse) next.delete(key);
        else next.add(key);
      }
      this.expandedLeadNotes = next;
    },
    getTableQualityIcon(this: SevaWorkspaceContext, quality: string): string {
      if (!quality.trim() || quality === this.getQualityFieldLabel()) return '—';
      const icon = this.getQualityMeta(quality).icon;
      return icon === DEFAULT_QUALITY_META_MAP[quality]?.icon
        ? TABLE_QUALITY_ICONS[quality] || icon
        : icon;
    },
    getTableFollowUpState(
      this: SevaWorkspaceContext,
      lead: Lead
    ): 'none' | 'due' | 'upcoming' {
      if (lead._followUpTs === null) return 'none';
      return lead._followUpTs <= this.getTodayDateOnlyTimestamp() ? 'due' : 'upcoming';
    },
    openLeadEdit(this: SevaWorkspaceContext, lead: Lead, trigger: HTMLElement): void {
      this.tableSheetTrigger = trigger;
      this.tableEditError = '';
      // Pickers edit this detached copy, so Cancel can discard the whole form.
      this.tableEditDraft = { ...lead, ...this.createLeadSnapshot(lead) };
      this.$nextTick?.(() => this.$refs?.tableEditSheet?.focus());
    },
    hasUnsavedLeadEdit(this: SevaWorkspaceContext): boolean {
      return Boolean(
        this.tableEditDraft && this.getLeadByKey(this.tableEditDraft.id)?.isDirty
      );
    },
    closeLeadEditOnEscape(this: SevaWorkspaceContext): void {
      if (
        !this.isOptionSheetOpen &&
        !this.isFollowUpModalOpen &&
        !this.isProgramEditorOpen
      ) {
        this.closeLeadEdit();
      }
    },
    closeLeadEdit(this: SevaWorkspaceContext): void {
      if (!this.tableEditDraft || this.isTableEditSaving) return;
      this.tableEditDraft = null;
      this.tableEditError = '';
      this.restoreTableSheetFocus();
    },
    restoreTableSheetFocus(this: SevaWorkspaceContext): void {
      const trigger = this.tableSheetTrigger;
      this.tableSheetTrigger = null;
      this.$nextTick?.(() => {
        if (trigger?.isConnected && trigger.getClientRects().length) trigger.focus();
        else this.$refs?.queueViewButton?.focus();
      });
    },
    async saveTableLeadEdit(this: SevaWorkspaceContext): Promise<void> {
      const draft = this.tableEditDraft;
      if (!draft || this.isTableEditSaving) return;
      const lead = this.getLeadByKey(draft.id) as Lead | null;
      if (!lead) {
        this.tableEditError = 'This record is no longer in the queue.';
        return;
      }
      const name = draft.name.trim();
      if (!name) {
        this.tableEditError = 'Enter a name before saving.';
        this.$refs?.tableEditName?.focus();
        return;
      }

      if (draft.mobile !== lead.mobile) {
        const mobile = normalizeIndianMobile(draft.mobile);
        if (!mobile) {
          this.tableEditError = 'Enter a valid 10-digit Indian mobile number.';
          this.$refs?.tableEditMobile?.focus();
          return;
        }
        draft.mobile = mobile;
      }

      this.tableEditError = '';
      this.authError = '';
      this.isTableEditSaving = true;
      draft.name = name;
      try {
        const saved = await this.commitLeadDraft(lead, draft);
        if (!saved) {
          this.tableEditError =
            this.authError || 'Unable to save your changes. Please try again.';
          this.authError = '';
          return;
        }
      } finally {
        this.isTableEditSaving = false;
      }
      if (!lead.notes.trim() && this.isLeadNoteExpanded(lead))
        this.toggleLeadNotes(lead);
      this.closeLeadEdit();
    },
    discardTableLeadChanges(this: SevaWorkspaceContext): void {
      const draft = this.tableEditDraft;
      if (!draft || this.isTableEditSaving) return;
      this.discardLeadChanges(this.getLeadByKey(draft.id));
      this.closeLeadEdit();
    }
  };
}
