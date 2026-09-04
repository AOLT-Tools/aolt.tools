import type {
  ResolvedSearchIntent,
  SearchSourceAdapter
} from '../searchIntent.js';

export const VDS_REGISTER_URL = 'https://register.vaidicpujas.in/';

export const vdsSearchAdapter: SearchSourceAdapter = {
  id: 'vds',
  label: 'Vaidic Pujas',

  supports(intent) {
    if (intent.source === 'aol' || intent.source === 'vvmvp') return false;
    if (intent.source === 'vds' || intent.source === 'all') return true;
    return intent.vdsMentioned || Boolean(intent.eventType);
  },

  buildResult(intent) {
    const filters: Record<string, string> = {};
    if (intent.eventType) filters.eventType = intent.eventType;
    if (intent.keywords?.length) filters.keywords = intent.keywords.join(', ');
    if (intent.dateLabel) filters.dates = intent.dateLabel;
    else if (intent.dateFrom && intent.dateTo) {
      filters.dates = intent.dateFrom + ' to ' + intent.dateTo;
    }
    if (intent.city) filters.city = intent.city;
    if (intent.teacher) filters.teacher = intent.teacher;

    const searchHint =
      intent.keywords?.[0] ||
      (intent.eventType === 'puja' && intent.rawQuery.toLowerCase().includes('rudra')
        ? 'Rudra Puja'
        : intent.eventType) ||
      '';

    return {
      source: 'vds',
      label: 'Vaidic Pujas',
      url: VDS_REGISTER_URL,
      filters,
      confidence: vdsConfidence(intent),
      embeddable: true,
      reason: vdsReason(intent),
      unsupportedFilters: [
        'The official Vaidic Puja site keeps search in page state and does not expose a shareable filter URL',
        ...(searchHint
          ? ['Use the official search box for: ' + searchHint]
          : [])
      ]
    };
  }
};

function vdsConfidence(intent: ResolvedSearchIntent): number {
  if (intent.eventType === 'puja' || /\brudra\b/i.test(intent.rawQuery)) return 0.95;
  if (intent.vdsMentioned || intent.eventType) return 0.9;
  return 0.5;
}

function vdsReason(intent: ResolvedSearchIntent): string {
  if (/\brudra\b/i.test(intent.rawQuery)) {
    return 'Rudra Puja and similar rituals are listed on the official Vaidic Puja registration site.';
  }
  return 'Pujas, homas, and Vaidic events are listed on register.vaidicpujas.in.';
}
