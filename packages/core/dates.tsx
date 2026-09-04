export type DatePreset =
  'today' | 'tomorrow' | 'this_week' | 'this_weekend' | 'next_week' | 'next_weekend';

export type DateRange = {
  start: string;
  end: string;
  label: string;
};

export function indiaDateParts(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.get('year')),
    month: Number(map.get('month')),
    day: Number(map.get('day'))
  };
}

export function isoDate(year: number, month: number, day: number): string {
  return (
    String(year).padStart(4, '0') +
    '-' +
    String(month).padStart(2, '0') +
    '-' +
    String(day).padStart(2, '0')
  );
}

export function todayInIndia(now = new Date()): string {
  const parts = indiaDateParts(now);
  return isoDate(parts.year, parts.month, parts.day);
}

export function addCalendarDays(start: string, days: number): string {
  const [year, month, day] = start.split('-').map(Number);
  const date = new Date(Date.UTC(year || 1970, (month || 1) - 1, (day || 1) + days));
  return date.toISOString().slice(0, 10);
}

export function yearFromNow(now = new Date()): string {
  return addCalendarDays(todayInIndia(now), 365);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function resolveDatePreset(
  preset: DatePreset | undefined,
  now = new Date()
): DateRange | undefined {
  if (!preset) return undefined;
  const today = indiaDateParts(now);
  const base = utcDate(today.year, today.month, today.day);
  const dow = dayOfWeek(base);

  switch (preset) {
    case 'today':
      return labeled(iso(base), iso(base), 'Today');
    case 'tomorrow':
      return labeled(iso(addDays(base, 1)), iso(addDays(base, 1)), 'Tomorrow');
    case 'this_week':
      return labeled(
        iso(addDays(base, -dow)),
        iso(addDays(base, 6 - dow)),
        'This week'
      );
    case 'this_weekend':
      return labeled(
        iso(addDays(base, 5 - dow)),
        iso(addDays(base, 6 - dow)),
        'This weekend'
      );
    case 'next_week':
      return labeled(
        iso(addDays(base, 7 - dow)),
        iso(addDays(base, 13 - dow)),
        'Next week'
      );
    case 'next_weekend':
      return labeled(
        iso(addDays(base, 12 - dow)),
        iso(addDays(base, 13 - dow)),
        'Next weekend'
      );
    default:
      return undefined;
  }
}

function labeled(start: string, end: string, label: string): DateRange {
  return { start, end, label };
}

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

function dayOfWeek(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}
