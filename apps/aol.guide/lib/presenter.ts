import type { OfficialSearchResponse } from './searchService.js';

export function formatSearchResponse(response: OfficialSearchResponse): string {
  const lines = [
    'Query: ' + response.query,
    response.usedGemini ? 'Parser: Gemini fallback' : 'Parser: deterministic',
    '',
    'Interpreted search:'
  ];

  if (!response.interpretation.length) {
    lines.push('  (no specific filters)');
  } else {
    for (const row of response.interpretation) {
      lines.push('  ' + row.label + ': ' + row.value);
    }
  }

  if (response.messages.length) {
    lines.push('', ...response.messages.map((message) => 'Note: ' + message));
  }

  if (!response.sources.length) {
    lines.push('', 'No matching official sources.');
    return lines.join('\n');
  }

  lines.push('', 'Official sources:');
  for (const source of response.sources) {
    lines.push(
      '',
      source.label,
      '  Why: ' + source.reason,
      '  URL: ' + source.url,
      ...Object.entries(source.filters).map(
        ([key, value]) => '  ' + key + ': ' + value
      ),
      ...source.unsupportedFilters.map((item) => '  Limitation: ' + item)
    );
    if (source.listingError) {
      lines.push('  Listing error: ' + source.listingError);
    }
    if (typeof source.listingTotal === 'number') {
      lines.push(
        '  Listings: ' +
          String(source.listings?.length || 0) +
          ' of ' +
          String(source.listingTotal)
      );
    }
    for (const listing of source.listings || []) {
      lines.push(
        '',
        '  - ' + listing.title,
        ...[
          listing.schedule,
          listing.location,
          typeof listing.distanceKm === 'number' ? listing.distanceKm.toFixed(1) + ' km' : '',
          listing.fee,
          listing.registerUrl || listing.detailUrl
        ]
          .filter(Boolean)
          .map((value) => '    ' + value)
      );
    }
  }

  return lines.join('\n');
}
