import {
  daysInMonth,
  indiaDateParts,
  isoDate,
  type DatePreset,
  type DateRange
} from '@aolt/core/dates';

export {
  addCalendarDays,
  indiaDateParts,
  isoDate,
  resolveDatePreset,
  todayInIndia,
  yearFromNow,
  type DatePreset,
  type DateRange
} from '@aolt/core/dates';

const MONTHS = [
  { number: 1, label: 'January', aliases: ['january', 'jan'] },
  { number: 2, label: 'February', aliases: ['february', 'feb'] },
  { number: 3, label: 'March', aliases: ['march', 'mar'] },
  { number: 4, label: 'April', aliases: ['april', 'apr'] },
  { number: 5, label: 'May', aliases: ['may'] },
  { number: 6, label: 'June', aliases: ['june', 'jun'] },
  { number: 7, label: 'July', aliases: ['july', 'jul'] },
  { number: 8, label: 'August', aliases: ['august', 'aug'] },
  { number: 9, label: 'September', aliases: ['september', 'sept', 'sep'] },
  { number: 10, label: 'October', aliases: ['october', 'oct'] },
  { number: 11, label: 'November', aliases: ['november', 'nov'] },
  { number: 12, label: 'December', aliases: ['december', 'dec'] }
] as const;

export const MONTH_PATTERN = MONTHS.flatMap((month) => month.aliases)
  .sort((left, right) => right.length - left.length)
  .map(escapeRegExp)
  .join('|');

export function detectDatePreset(normalized: string): DatePreset | undefined {
  if (/\bnext\s+weekend\b/i.test(normalized)) return 'next_weekend';
  if (/\bthis\s+weekend\b/i.test(normalized)) return 'this_weekend';
  if (/\bnext\s+week\b/i.test(normalized)) return 'next_week';
  if (/\bthis\s+week\b/i.test(normalized)) return 'this_week';
  if (/\btomorrow\b/i.test(normalized)) return 'tomorrow';
  if (/\btoday\b/i.test(normalized)) return 'today';
  return undefined;
}

export function detectNamedMonthRange(
  query: string,
  now = new Date()
): { range: DateRange; phrase: string } | undefined {
  const relative = detectRelativeMonthRange(query, now);
  if (relative) return relative;

  const match = query.match(
    new RegExp(
      '\\b(?:in|during|for)?\\s*(?:the\\s+)?(?:month\\s+of\\s+)?(' +
        MONTH_PATTERN +
        ')(?:\\s+(20\\d{2}|19\\d{2}))?\\b',
      'i'
    )
  );
  const monthToken = match?.[1]?.toLowerCase();
  if (!match || !monthToken) return undefined;

  const month = MONTHS.find((candidate) =>
    candidate.aliases.some((alias) => alias === monthToken)
  );
  if (!month) return undefined;

  const indiaToday = indiaDateParts(now);
  const explicitYear = match[2] ? Number(match[2]) : null;
  const year =
    explicitYear ||
    (month.number < indiaToday.month ? indiaToday.year + 1 : indiaToday.year);

  return {
    phrase: match[0],
    range: {
      start: isoDate(year, month.number, 1),
      end: isoDate(year, month.number, daysInMonth(year, month.number)),
      label: month.label + ' ' + year
    }
  };
}

export function stripMonthExpressions(value: string): string {
  return value.replace(
    new RegExp(
      '\\b(?:in|during|for)?\\s*(?:the\\s+)?(?:month\\s+of\\s+)?(' +
        MONTH_PATTERN +
        ')(?:\\s+(20\\d{2}|19\\d{2}))?\\b',
      'gi'
    ),
    ' '
  );
}

export function currentDayTimeFrom(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).formatToParts(now);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return (
    String(Number(map.get('hour') || '0')) +
    '.' +
    String(Number(map.get('minute') || '0'))
  );
}

function detectRelativeMonthRange(
  query: string,
  now = new Date()
): { range: DateRange; phrase: string } | undefined {
  const match = query.match(/\b(this|next)\s+month\b/i);
  if (!match?.[0] || !match[1]) return undefined;

  const indiaToday = indiaDateParts(now);
  const offset = match[1].toLowerCase() === 'next' ? 1 : 0;
  const monthIndex = indiaToday.month - 1 + offset;
  const year = indiaToday.year + Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  const label = MONTHS.find((candidate) => candidate.number === month)?.label;

  return {
    phrase: match[0],
    range: {
      start: isoDate(year, month, 1),
      end: isoDate(year, month, daysInMonth(year, month)),
      label: (label || 'Month') + ' ' + year
    }
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
