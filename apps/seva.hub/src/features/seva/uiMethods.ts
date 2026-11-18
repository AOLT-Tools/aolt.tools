import type {
  SevaWorkspaceContext,
  Lead,
  OptionItem,
  QualityMeta,
  StatusMeta,
  TextSize
} from './types';
import { getDefaultQualityOptionsForCampaignType } from '../../config/campaignDefaults';

const TEXT_SIZE_SCALE: Record<TextSize, string> = {
  normal: '1',
  large: '1.125',
  extraLarge: '1.25'
};

export function createUiMethods() {
  return {
    scheduleActionMessage(this: SevaWorkspaceContext, message: string): void {
      if (this.actionMessageTimer !== null) {
        clearTimeout(this.actionMessageTimer);
        this.actionMessageTimer = null;
      }
      if (!message) return;
      this.actionMessageText = message;
      this.actionMessageTimer = setTimeout(() => {
        this.actionMessage = '';
        this.actionMessageTimer = null;
      }, 8000);
    },
    applyTextSizePreference(this: SevaWorkspaceContext): void {
      const scale = TEXT_SIZE_SCALE[this.textSize] || TEXT_SIZE_SCALE.normal;
      if (!document.documentElement) {
        return;
      }
      document.documentElement.style.setProperty('--seva-hub-font-scale', scale);
    },
    setTextSize(this: SevaWorkspaceContext, size: TextSize): void {
      this.textSize = size;
      this.applyTextSizePreference();
    },
    dismissActionMessage(this: SevaWorkspaceContext): void {
      this.actionMessage = '';
    },
    dismissAuthError(this: SevaWorkspaceContext): void {
      this.authError = '';
    },
    toggleFilterPanel(this: SevaWorkspaceContext): void {
      this.isFilterPanelOpen = !this.isFilterPanelOpen;
    },
    selectFilter(this: SevaWorkspaceContext, filterId: string): void {
      this.selectedFilter = filterId;
    },
    clearSearch(this: SevaWorkspaceContext): void {
      this.searchQuery = '';
    },
    clearProgramFilter(this: SevaWorkspaceContext): void {
      this.programFilter = '';
    },
    toggleProgramFilter(this: SevaWorkspaceContext, programCode: string): void {
      this.programFilter = this.programFilter === programCode ? '' : programCode;
    },
    setMetricFilter(this: SevaWorkspaceContext, filter: string): void {
      this.metricFilter = filter;
    },
    closeFab(this: SevaWorkspaceContext): void {
      this.isFabOpen = false;
    },
    toggleFab(this: SevaWorkspaceContext): void {
      this.isFabOpen = !this.isFabOpen;
    },
    handleSelectionBarEscape(this: SevaWorkspaceContext): void {
      if (this.isSelectionMode() && !this.isOptionSheetOpen) {
        this.clearSelection();
        return;
      }
      this.closeFab();
    },
    getQualityMeta(this: SevaWorkspaceContext, quality: string): QualityMeta {
      return this.qualityMetaMap[quality] || this.defaultQualityMeta;
    },
    getStatusMeta(this: SevaWorkspaceContext, status: string): StatusMeta {
      const label = String(status || '').trim() || 'Response';
      return {
        icon: this.statusIconMap[label] || this.defaultStatusIcon,
        label: label
      };
    },
    toOptionItems(
      this: SevaWorkspaceContext,
      values: string[],
      iconMap?: Record<string, string>
    ): OptionItem[] {
      return (values || []).map((value: string) => ({
        value: value,
        label: value,
        icon: iconMap ? iconMap[value] : undefined
      }));
    },
    openOptionSheet(
      this: SevaWorkspaceContext,
      mode: 'quality' | 'status',
      lead?: Lead
    ): void {
      if (
        !lead &&
        (mode !== 'quality' ||
          !this.isCreateRecordModalOpen ||
          this.isCreateRecordSaving)
      ) {
        return;
      }
      if (lead) {
        this.activateCard(lead);
      }
      this.optionSheetMode = lead ? mode : 'createQuality';
      this.activeOptionLead = lead || null;

      if (mode === 'quality') {
        const qualityPlaceholder = lead
          ? this.getQualityFieldLabel()
          : this.createRecordType === 'Members'
            ? 'Engagement'
            : 'Quality';
        this.optionSheetTitle = 'Update ' + qualityPlaceholder;
        const qualityValues = (
          lead
            ? (this.qualityOptions || []).map((item: OptionItem) => item.value)
            : [...getDefaultQualityOptionsForCampaignType(this.createRecordType)]
        ).filter((value: string) => value !== qualityPlaceholder);
        const qualityIconMap: Record<string, string> = {};
        qualityValues.forEach((quality: string) => {
          qualityIconMap[quality] =
            lead && this.leadQueueView === 'table'
              ? this.getTableQualityIcon(quality)
              : this.getQualityMeta(quality).icon;
        });
        this.optionSheetOptions = this.toOptionItems(qualityValues, qualityIconMap);
        this.currentOptionValue = lead ? lead.quality : this.createRecordDraft.quality;
      } else if (lead) {
        this.optionSheetTitle =
          this.leadQueueView === 'table' ? 'Call response' : 'Update Status';
        const statusIconMap: Record<string, string> = {};
        const statusValues = (this.statusOptions || []).filter(
          (status: string) => status !== 'Response'
        );
        statusValues.forEach((status: string) => {
          statusIconMap[status] = this.getStatusMeta(status).icon;
        });
        this.optionSheetOptions = this.toOptionItems(statusValues, statusIconMap);
        this.currentOptionValue = lead.status;
      }

      this.isOptionSheetOpen = true;
      this.$nextTick?.(() => this.$refs?.optionSheet?.focus());
    },
    closeOptionSheet(this: SevaWorkspaceContext): void {
      const editingCreateRecord = this.optionSheetMode === 'createQuality';
      const editingTableDraft =
        this.tableEditDraft && this.activeOptionLead === this.tableEditDraft;
      const tableField =
        this.optionSheetMode === 'quality'
          ? 'tableEditQuality'
          : 'tableEditStatus';
      this.isOptionSheetOpen = false;
      this.optionSheetMode = '';
      this.optionSheetTitle = '';
      this.optionSheetOptions = [];
      this.currentOptionValue = '';
      this.activeOptionLead = null;
      if (editingCreateRecord) {
        this.$nextTick?.(() => this.$refs?.createRecordQuality?.focus());
      } else if (editingTableDraft) {
        this.$nextTick?.(() => this.$refs?.[tableField]?.focus());
      }
    },
    async applyOptionSelection(
      this: SevaWorkspaceContext,
      value: string
    ): Promise<void> {
      if (this.optionSheetMode === 'sort') {
        await this.selectLeadSort(value);
        return;
      }
      if (this.optionSheetMode === 'createQuality') {
        this.createRecordDraft.quality = value;
        this.closeOptionSheet();
        return;
      }
      if (this.optionSheetMode === 'campaign') {
        this.closeOptionSheet();
        await this.onCampaignChange(value);
        return;
      }

      if (this.optionSheetMode === 'moveCampaign') {
        this.closeOptionSheet();
        await this.moveSelectedRecords(value);
        return;
      }

      if (this.optionSheetMode === 'reassignVolunteer') {
        this.closeOptionSheet();
        await this.reassignSelectedRecords(value);
        return;
      }

      if (!this.activeOptionLead || !this.optionSheetMode) {
        this.closeOptionSheet();
        return;
      }

      const lead = this.activeOptionLead;
      const field = this.optionSheetMode === 'quality' ? 'quality' : 'status';
      this.closeOptionSheet();
      await this.applyLeadPickerValue(lead, field, value);
    },
    openFollowUpPicker(this: SevaWorkspaceContext, lead: Lead): void {
      this.activateCard(lead);
      this.activeFollowUpLead = lead;
      this.followUpDraft = this.toDateTimeLocal(lead.followUp);
      this.isFollowUpModalOpen = true;
      this.$nextTick?.(() => {
        if (this.$refs?.followUpInput) {
          this.$refs.followUpInput.focus();
        }
      });
    },
    closeFollowUpPicker(this: SevaWorkspaceContext): void {
      const editingTableDraft =
        this.tableEditDraft && this.activeFollowUpLead === this.tableEditDraft;
      this.isFollowUpModalOpen = false;
      this.activeFollowUpLead = null;
      this.followUpDraft = '';
      if (editingTableDraft) {
        this.$nextTick?.(() => this.$refs?.tableEditFollowUp?.focus());
      }
    },
    async applyFollowUpPicker(this: SevaWorkspaceContext): Promise<void> {
      if (!this.activeFollowUpLead || !this.followUpDraft) {
        this.closeFollowUpPicker();
        return;
      }
      const lead = this.activeFollowUpLead;
      const value = this.followUpDraft;
      this.closeFollowUpPicker();
      await this.applyLeadPickerValue(lead, 'followUp', value);
    },
    async clearFollowUpPicker(this: SevaWorkspaceContext): Promise<void> {
      const lead = this.activeFollowUpLead;
      this.closeFollowUpPicker();
      if (lead) await this.applyLeadPickerValue(lead, 'followUp', 'Follow-up');
    },
    async applyLeadPickerValue(
      this: SevaWorkspaceContext,
      lead: Lead,
      field: 'quality' | 'status' | 'followUp',
      value: string
    ): Promise<void> {
      if (lead[field] !== value) {
        lead[field] = value;
        this.markLeadFilterDirty(lead);
      }
      if (
        this.leadQueueView === 'table' &&
        lead !== this.tableEditDraft &&
        lead.isDirty
      ) {
        await this.commitLeadChanges(lead);
      }
    },
    cleanPhone(this: SevaWorkspaceContext, phone: string): string {
      return String(phone || '').replace(/[^0-9]/g, '');
    }
  };
}
