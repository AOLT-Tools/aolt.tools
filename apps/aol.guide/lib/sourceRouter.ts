import type { ResolvedSearchIntent, SearchSourceId } from './searchIntent.js';
import { aolSearchAdapter } from './sources/aolSearchAdapter.js';
import { vdsSearchAdapter } from './sources/vdsSearchAdapter.js';
import { vvmvpSearchAdapter } from './sources/vvmvpSearchAdapter.js';

export const SEARCH_SOURCE_ADAPTERS = [
  aolSearchAdapter,
  vvmvpSearchAdapter,
  vdsSearchAdapter
] as const;

export function routeSources(intent: ResolvedSearchIntent): SearchSourceId[] {
  if (intent.source === 'aol' || intent.source === 'vvmvp' || intent.source === 'vds') {
    return [intent.source];
  }

  const vds = intent.vdsMentioned || Boolean(intent.eventType);
  const ashram = intent.ashramMentioned;
  const specificAolCourse = Boolean(
    intent.courseCode && intent.courseCode !== 'FOLLOW_UP'
  );
  const bangalore = /\b(bangalore|bengaluru)\b/i.test(
    [intent.city, intent.rawQuery].filter(Boolean).join(' ')
  );
  const vagueMeditation =
    /\bmeditation\b/i.test(intent.rawQuery) && !specificAolCourse;

  if (intent.source === 'all') {
    return unique([
      ...(specificAolCourse || !vds ? (['aol'] as const) : []),
      ...(ashram || bangalore ? (['vvmvp'] as const) : []),
      ...(vds ? (['vds'] as const) : [])
    ]);
  }

  if (vds && !specificAolCourse && !ashram) return ['vds'];
  if (ashram) {
    return unique([
      'vvmvp',
      ...(specificAolCourse ? (['aol'] as const) : []),
      ...(vds ? (['vds'] as const) : [])
    ]);
  }
  if (specificAolCourse) return ['aol'];
  if (vagueMeditation && bangalore) return ['aol', 'vvmvp'];
  if (bangalore && !vds && !specificAolCourse) return ['aol', 'vvmvp'];
  if (vds) return ['vds'];
  return ['aol'];
}

function unique(values: readonly SearchSourceId[]): SearchSourceId[] {
  return [...new Set(values)];
}
