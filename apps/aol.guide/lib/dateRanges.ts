import {
  addCalendarDays,
  resolveDatePreset,
  todayInIndia,
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

export type OnlineTimePreset =
  | 'anytime'
  | 'today'
  | 'tomorrow'
  | 'this_weekend'
  | 'next_7_days'
  | 'custom';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = value.trim().match(ISO_DATE);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return undefined;
  }
  return match[1] + '-' + match[2] + '-' + match[3];
}

export function resolveCustomDateRange(
  dateFrom?: string,
  dateTo?: string
): DateRange | undefined {
  const start = parseIsoDate(dateFrom);
  const end = parseIsoDate(dateTo);
  if (!start || !end) return undefined;
  const [from, to] = start <= end ? [start, end] : [end, start];
  return {
    start: from,
    end: to,
    label: from === to ? from : from + ' to ' + to
  };
}

export function resolveOnlineTimePreset(
  preset: OnlineTimePreset | undefined,
  now = new Date()
): DateRange | undefined {
  if (!preset || preset === 'anytime' || preset === 'custom') return undefined;
  if (preset === 'next_7_days') {
    const start = todayInIndia(now);
    return {
      start,
      end: addCalendarDays(start, 6),
      label: 'Next 7 days'
    };
  }
  return resolveDatePreset(preset, now);
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
