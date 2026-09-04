import type {
  ResolvedSearchIntent,
  SearchSourceAdapter,
  SourceSearchResult
} from '../searchIntent.js';

export const VVMVP_BANGALORE_URL =
  'https://programs.vvmvp.org/ashrams/bangalore/';

export const vvmvpSearchAdapter: SearchSourceAdapter = {
  id: 'vvmvp',
  label: 'Bangalore Ashram Programs',

  supports(intent) {
    if (intent.source === 'aol' || intent.source === 'vds') return false;
    if (intent.source === 'vvmvp' || intent.source === 'all') return true;
    return (
      intent.ashramMentioned ||
      isBangaloreLocation(intent) ||
      Boolean(intent.teacher)
    );
  },

  buildResult(intent) {
    const search = vvmvpSearchText(intent);
    const url = search
      ? VVMVP_BANGALORE_URL + '?search=' + encodeURIComponent(search)
      : VVMVP_BANGALORE_URL;
    const filters: Record<string, string> = {
      ashram: 'Bangalore Ashram'
    };
    if (search) filters.search = search;
    if (intent.dateLabel) filters.dates = intent.dateLabel;
    if (intent.teacher) filters.teacher = intent.teacher;

    return {
      source: 'vvmvp',
      label: 'Bangalore Ashram Programs',
      url,
      filters,
      confidence: vvmvpConfidence(intent),
      embeddable: true,
      reason: vvmvpReason(intent),
      unsupportedFilters: unsupportedVvmvpFilters(intent)
    };
  }
};

export function vvmvpSearchText(intent: ResolvedSearchIntent): string {
  if (intent.teacher) return intent.teacher;
  if (intent.courseCode && intent.courseCode !== 'FOLLOW_UP') {
    return intent.courseCode;
  }
  if (intent.courseLabel) return intent.courseLabel;
  const keywords = (intent.keywords || []).filter(
    (keyword) => !/bangalore|bengaluru|ashram/i.test(keyword)
  );
  return keywords.slice(0, 4).join(' ').trim();
}

function isBangaloreLocation(intent: ResolvedSearchIntent): boolean {
  return /\b(bangalore|bengaluru)\b/i.test(
    [intent.city, intent.rawQuery].filter(Boolean).join(' ')
  );
}

function vvmvpConfidence(intent: ResolvedSearchIntent): number {
  if (intent.ashramMentioned) return 0.95;
  if (intent.teacher) return 0.8;
  if (isBangaloreLocation(intent)) return 0.7;
  return 0.5;
}

function vvmvpReason(intent: ResolvedSearchIntent): string {
  if (intent.ashramMentioned) {
    return 'Bangalore Ashram programs are listed on the official VVMVP ashram page.';
  }
  if (intent.teacher) {
    return intent.teacher + ' is searched in Bangalore Ashram programs.';
  }
  return 'Bangalore-related programs may appear on the VVMVP ashram calendar.';
}

function unsupportedVvmvpFilters(intent: ResolvedSearchIntent): string[] {
  const unsupported: string[] = [];
  if (intent.dateFrom || intent.dateTo) {
    unsupported.push('Date filters are not exposed as VVMVP URL parameters');
  }
  if (intent.pincode || intent.radiusKm) {
    unsupported.push('PIN / distance filters are not exposed as VVMVP URL parameters');
  }
  if (intent.language) {
    unsupported.push('Language is not exposed as a VVMVP URL parameter');
  }
  if (intent.deliveryMode && intent.deliveryMode !== 'any') {
    unsupported.push('Online / in-person is not exposed as a VVMVP URL parameter');
  }
  return unsupported;
}
