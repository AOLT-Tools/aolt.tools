import type { Lead, SevaWorkspaceContext } from './types';

export const SORT_OPTIONS = [
  { value: 'name-asc', label: 'Name: A → Z' },
  { value: 'name-desc', label: 'Name: Z → A' },
  { value: 'added-desc', label: 'Lead added: newest first' },
  { value: 'added-asc', label: 'Lead added: oldest first' },
  { value: 'updated-desc', label: 'Lead updated: most recent first' },
  { value: 'updated-asc', label: 'Lead updated: least recent first' }
];
export const DEFAULT_LEAD_SORT = 'added-desc';
const valid = (value: string) => SORT_OPTIONS.some((option) => option.value === value);
const storageKey = (email: string) => 'sevaHub.leadSort.' + email.trim().toLowerCase();

export function sortLeads(leads: Lead[], key: string): Lead[] {
  const [field, direction] = (valid(key) ? key : DEFAULT_LEAD_SORT).split('-');
  const collator = new Intl.Collator(undefined, {
    sensitivity: 'base',
    numeric: true
  });
  return [...leads].sort((a, b) => {
    // Keep an active card in place while it is being edited or saved.
    let result = 0;
    if (field === 'name')
      result = collator.compare(
        a._originalData?.name ?? a.name,
        b._originalData?.name ?? b.name
      );
    else {
      const dateA = Date.parse(
        field === 'added' ? a.createdAt || '' : (a.lastSavedAt ?? a.lastUpdated)
      );
      const dateB = Date.parse(
        field === 'added' ? b.createdAt || '' : (b.lastSavedAt ?? b.lastUpdated)
      );
      if (!Number.isFinite(dateA) || !Number.isFinite(dateB)) {
        if (Number.isFinite(dateA)) return -1;
        if (Number.isFinite(dateB)) return 1;
      } else result = dateA - dateB;
    }
    // Stable ties preserve existing row order, including records with unknown dates.
    return direction === 'desc' ? -result : result;
  });
}

export function createSortingMethods() {
  return {
    restoreLeadSort(this: SevaWorkspaceContext): void {
      this.leadSort = DEFAULT_LEAD_SORT;
      try {
        const saved = window.localStorage?.getItem(storageKey(this.volunteerEmail));
        if (saved && valid(saved)) this.leadSort = saved;
      } catch {
        /* Browser storage may be unavailable. */
      }
    },
    getSortLabel(this: SevaWorkspaceContext): string {
      return (
        SORT_OPTIONS.find((option) => option.value === this.leadSort)?.label ||
        SORT_OPTIONS[2].label
      );
    },
    openSortSheet(this: SevaWorkspaceContext): void {
      this.optionSheetMode = 'sort';
      this.optionSheetTitle = 'Sort leads';
      this.optionSheetOptions = SORT_OPTIONS.map((option) => ({ ...option }));
      this.currentOptionValue = this.leadSort;
      this.activeOptionLead = null;
      this.isOptionSheetOpen = true;
    },
    async selectLeadSort(this: SevaWorkspaceContext, value: string): Promise<void> {
      if (!valid(value) || !(await this.flushPendingSaves())) return;
      this.leadSort = value;
      this.visibleLeadLimit = this.pageSize;
      try {
        window.localStorage?.setItem(storageKey(this.volunteerEmail), value);
      } catch {
        /* Keep the in-memory preference. */
      }
      this.closeOptionSheet();
    }
  };
}
