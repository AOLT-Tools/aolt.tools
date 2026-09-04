import type { SevaWorkspaceContext, Lead } from './types';

type FilterCache = {
  sourceLeads: Lead[];
  criteriaKey: string;
  dataKey: string;
  filtered: Lead[];
  dueCount: number;
  upcomingCount: number;
};

const filterCacheByContext = new WeakMap<object, FilterCache>();

function programKey(value: string | string[]): string {
  return Array.isArray(value) ? value.join(',') : String(value || '');
}

function buildLeadFilterDataKey(leads: Lead[]): string {
  return (leads || [])
    .map((lead) =>
      [
        lead.id,
        lead.quality,
        lead.status,
        lead._nameLower,
        lead._phoneRawLower,
        lead._phoneDigits,
        String(lead._followUpTs ?? ''),
        programKey(lead.wishlistPrograms),
        programKey(lead.donePrograms)
      ].join('\u001f')
    )
    .join('\u001e');
}

export function createDateAndFilterMethods() {
  return {
    parseDate(
      this: SevaWorkspaceContext,
      value: Date | number | string | null | undefined
    ): Date | null {
      if (!value) {
        return null;
      }

      if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
      }

      if (typeof value === 'number') {
        const numericDate = new Date(value);
        return Number.isNaN(numericDate.getTime()) ? null : numericDate;
      }

      const raw = String(value).trim();
      if (!raw) {
        return null;
      }

      const candidates = [raw, raw.replace(/\s*\([^)]*\)\s*$/, '')];

      for (let i = 0; i < candidates.length; i++) {
        const parsed = new Date(candidates[i]);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed;
        }
      }

      const monthMap: Record<string, string> = {
        Jan: '01',
        Feb: '02',
        Mar: '03',
        Apr: '04',
        May: '05',
        Jun: '06',
        Jul: '07',
        Aug: '08',
        Sep: '09',
        Oct: '10',
        Nov: '11',
        Dec: '12'
      };
      const match = raw.match(
        /^(?:\w{3})\s(\w{3})\s(\d{1,2})\s(\d{4})\s(\d{2}:\d{2}:\d{2})\sGMT([+-])(\d{2})(\d{2})(?:\s.*)?$/
      );
      if (!match) {
        return null;
      }

      const month = monthMap[match[1]];
      if (!month) {
        return null;
      }

      const day = String(match[2]).padStart(2, '0');
      const year = match[3];
      const time = match[4];
      const sign = match[5];
      const tzHour = match[6];
      const tzMinute = match[7];
      const iso =
        year + '-' + month + '-' + day + 'T' + time + sign + tzHour + ':' + tzMinute;
      const parsedIso = new Date(iso);
      return Number.isNaN(parsedIso.getTime()) ? null : parsedIso;
    },
    getDateOnlyTimestampFromDate(this: SevaWorkspaceContext, date: Date): number {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    },
    formatRelativeDate(
      this: SevaWorkspaceContext,
      value: Date | number | string | null | undefined,
      emptyText?: string
    ): string {
      if (!value) {
        return emptyText || 'Follow Up';
      }
      const date = this.parseDate(value);
      if (!date) {
        return String(value);
      }
      const diffMs = date.getTime() - Date.now();

      const minuteMs = 60 * 1000;
      const hourMs = 60 * minuteMs;
      const dayMs = 24 * hourMs;

      if (Math.abs(diffMs) < minuteMs) {
        return 'Just now';
      }

      if (diffMs > 0) {
        if (diffMs < hourMs) {
          const mins = Math.floor(diffMs / minuteMs);
          return mins === 1 ? 'in 1 min' : 'in ' + mins + ' mins';
        }
        if (diffMs < dayMs) {
          const hours = Math.floor(diffMs / hourMs);
          return hours === 1 ? 'in 1 hr' : 'in ' + hours + ' hrs';
        }

        const days = Math.floor(diffMs / dayMs);
        return days === 1 ? 'in 1 day' : 'in ' + days + ' days';
      }

      const ageMs = Math.abs(diffMs);
      if (ageMs < hourMs) {
        const mins = Math.floor(ageMs / minuteMs);
        return mins === 1 ? '1 min ago' : mins + ' mins ago';
      }
      if (ageMs < dayMs) {
        const hours = Math.floor(ageMs / hourMs);
        return hours === 1 ? '1 hr ago' : hours + ' hrs ago';
      }

      const days = Math.floor(ageMs / dayMs);
      return days === 1 ? '1 day ago' : days + ' days ago';
    },
    formatShortDate(
      this: SevaWorkspaceContext,
      value: Date | number | string | null | undefined,
      emptyText?: string
    ): string {
      if (!value) {
        return emptyText || 'Just now';
      }
      const date = this.parseDate(value);
      if (!date) {
        return String(value);
      }
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');
      const currentYear = new Date().getFullYear();

      if (date.getFullYear() !== currentYear) {
        const year = String(date.getFullYear()).slice(-2);
        return day + '/' + month + '/' + year + ' ' + hour + ':' + minute;
      }

      return day + '/' + month + ' ' + hour + ':' + minute;
    },
    toDateTimeLocal(
      this: SevaWorkspaceContext,
      value: Date | number | string | null | undefined
    ): string {
      const date = value ? this.parseDate(value) : new Date();
      if (!date) {
        const fallback = new Date();
        fallback.setMinutes(fallback.getMinutes() + 30);
        return this.toDateTimeLocal(fallback.toISOString());
      }
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');
      return year + '-' + month + '-' + day + 'T' + hour + ':' + minute;
    },
    getTodayDateOnlyTimestamp(this: SevaWorkspaceContext): number {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    },
    // Filtering is tiny at this app's scale, but Alpine can ask for the same
    // list several times in one render. Cache the last result while keeping
    // pagination reset tied only to criteria changes, not plain data edits.
    computeFilteredLeads(this: SevaWorkspaceContext): Lead[] {
      const searchTerm = String(this.searchQuery || '')
        .trim()
        .toLowerCase();
      const searchDigits = this.cleanPhone(searchTerm);
      const mode = this.selectedFilter || 'all';
      const todayTs = this.getTodayDateOnlyTimestamp();
      const criteriaKey = [
        this.selectedCampaignId,
        this.campaignType,
        mode,
        this.metricFilter,
        searchTerm,
        this.programFilter,
        String(todayTs)
      ].join('|');

      if (this.filteredCriteriaKey !== criteriaKey) {
        this.visibleLeadLimit = this.pageSize;
      }
      this.filteredCriteriaKey = criteriaKey;

      const sourceLeads = this.leads || [];
      const dataKey = buildLeadFilterDataKey(sourceLeads);
      const cached = filterCacheByContext.get(this);
      if (
        cached &&
        cached.sourceLeads === sourceLeads &&
        cached.criteriaKey === criteriaKey &&
        cached.dataKey === dataKey
      ) {
        this.dueFollowUpCount = cached.dueCount;
        this.upcomingFollowUpCount = cached.upcomingCount;
        return cached.filtered;
      }

      let dueCount = 0;
      let upcomingCount = 0;
      const filtered = (this.leads || []).filter((lead: Lead) => {
        const followUpTs = lead._followUpTs;

        if (followUpTs !== null && followUpTs <= todayTs) {
          dueCount += 1;
        }
        if (followUpTs !== null && followUpTs > todayTs) {
          upcomingCount += 1;
        }

        let modeMatch = true;
        if (mode === 'hot') {
          modeMatch = lead.quality === 'Hot';
        } else if (mode === 'active') {
          modeMatch = lead.quality === 'Active';
        } else if (mode === 'no_answer') {
          modeMatch = lead.status === 'No Answer';
        } else if (mode === 'callback') {
          modeMatch = lead.status === 'Call Back';
        } else if (mode === 'followup_today') {
          modeMatch = followUpTs !== null && followUpTs === todayTs;
        }

        let metricMatch = true;
        if (this.metricFilter === 'due') {
          metricMatch = followUpTs !== null && followUpTs <= todayTs;
        } else if (this.metricFilter === 'upcoming') {
          metricMatch = followUpTs !== null && followUpTs > todayTs;
        }

        if (!searchTerm) {
          if (!this.programFilter) return modeMatch && metricMatch;
          const allPrograms = [
            ...this.parsePrograms(lead.wishlistPrograms),
            ...this.parsePrograms(lead.donePrograms)
          ];
          const programMatch = allPrograms.some(
            (p: string) => p.toUpperCase() === this.programFilter.toUpperCase()
          );
          return modeMatch && metricMatch && programMatch;
        }

        const matchesSearch =
          lead._nameLower.includes(searchTerm) ||
          lead._phoneRawLower.includes(searchTerm) ||
          (searchDigits && lead._phoneDigits.includes(searchDigits));

        if (!this.programFilter) return modeMatch && metricMatch && matchesSearch;
        const allPrograms2 = [
          ...this.parsePrograms(lead.wishlistPrograms),
          ...this.parsePrograms(lead.donePrograms)
        ];
        const programMatch2 = allPrograms2.some(
          (p: string) => p.toUpperCase() === this.programFilter.toUpperCase()
        );
        return modeMatch && metricMatch && matchesSearch && programMatch2;
      });

      this.dueFollowUpCount = dueCount;
      this.upcomingFollowUpCount = upcomingCount;
      filterCacheByContext.set(this, {
        sourceLeads,
        criteriaKey,
        dataKey,
        filtered,
        dueCount,
        upcomingCount
      });
      return filtered;
    },
    countDueFollowUps(this: SevaWorkspaceContext): number {
      this.computeFilteredLeads();
      return this.dueFollowUpCount;
    },
    countUpcomingFollowUps(this: SevaWorkspaceContext): number {
      this.computeFilteredLeads();
      return this.upcomingFollowUpCount;
    },
    getFilterSummary(this: SevaWorkspaceContext): string {
      const selected = this.filterOptions.find(
        (item) => item.id === this.selectedFilter
      );
      const label = selected ? selected.label : 'All';
      const hasSearch = String(this.searchQuery || '').trim().length > 0;
      return hasSearch ? label + ' + Search' : label;
    },
    filteredLeads(this: SevaWorkspaceContext): Lead[] {
      return this.computeFilteredLeads();
    },
    visibleLeads(this: SevaWorkspaceContext): Lead[] {
      return this.computeFilteredLeads().slice(0, this.visibleLeadLimit);
    },
    hasMoreLeads(this: SevaWorkspaceContext): boolean {
      return this.visibleLeadLimit < this.computeFilteredLeads().length;
    },
    loadMoreLeads(this: SevaWorkspaceContext): void {
      this.visibleLeadLimit = Math.min(
        this.visibleLeadLimit + this.pageSize,
        this.filteredLeads().length
      );
    }
  };
}
