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
      if (this.isSelectionMode()) {
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
          qualityIconMap[quality] = this.getQualityMeta(quality).icon;
        });
        this.optionSheetOptions = this.toOptionItems(qualityValues, qualityIconMap);
        this.currentOptionValue = lead ? lead.quality : this.createRecordDraft.quality;
      } else if (lead) {
        this.optionSheetTitle = 'Update Status';
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
      this.isOptionSheetOpen = false;
      this.optionSheetMode = '';
      this.optionSheetTitle = '';
      this.optionSheetOptions = [];
      this.currentOptionValue = '';
      this.activeOptionLead = null;
      if (editingCreateRecord) {
        this.$nextTick?.(() => this.$refs?.createRecordQuality?.focus());
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

      if (this.optionSheetMode === 'quality') {
        this.activeOptionLead.quality = value;
      } else {
        this.activeOptionLead.status = value;
      }

      this.markLeadFilterDirty(this.activeOptionLead);
      this.closeOptionSheet();
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
      this.isFollowUpModalOpen = false;
      this.activeFollowUpLead = null;
      this.followUpDraft = '';
    },
    applyFollowUpPicker(this: SevaWorkspaceContext): void {
      if (!this.activeFollowUpLead || !this.followUpDraft) {
        this.closeFollowUpPicker();
        return;
      }
      this.activeFollowUpLead.followUp = this.followUpDraft;
      this.markLeadFilterDirty(this.activeFollowUpLead);
      this.closeFollowUpPicker();
    },
    clearFollowUpPicker(this: SevaWorkspaceContext): void {
      if (!this.activeFollowUpLead) {
        this.closeFollowUpPicker();
        return;
      }
      this.activeFollowUpLead.followUp = 'Follow-up';
      this.markLeadFilterDirty(this.activeFollowUpLead);
      this.closeFollowUpPicker();
    },
    cleanPhone(this: SevaWorkspaceContext, phone: string): string {
      return String(phone || '').replace(/[^0-9]/g, '');
    }
  };
}
