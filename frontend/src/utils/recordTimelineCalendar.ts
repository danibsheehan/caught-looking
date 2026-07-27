import type { RecordPoint } from '../types/api.compat';

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export type CalendarDay = {
  /** ISO `YYYY-MM-DD` when this cell is in the month; null for leading/trailing padding. */
  date: string | null;
  dayOfMonth: number | null;
  games: RecordPoint[];
};

export type CalendarMonth = {
  key: string;
  year: number;
  month: number;
  label: string;
  days: CalendarDay[];
};

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});

/** Parse `YYYY-MM-DD` as calendar parts (no timezone shift). */
export function parseOfficialDate(
  iso: string,
): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function isoKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function weekdaySundayFirst(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay();
}

/**
 * Group completed games into month calendars (Sunday–Saturday grids).
 * Multiple games on the same date (doubleheaders) share one cell.
 */
export function buildRecordCalendarMonths(points: RecordPoint[]): CalendarMonth[] {
  const byDate = new Map<string, RecordPoint[]>();
  for (const point of points) {
    const parsed = parseOfficialDate(point.officialDate);
    if (!parsed) continue;
    const key = isoKey(parsed.year, parsed.month, parsed.day);
    const list = byDate.get(key);
    if (list) list.push(point);
    else byDate.set(key, [point]);
  }

  const monthKeys = new Set<string>();
  for (const date of byDate.keys()) {
    monthKeys.add(date.slice(0, 7));
  }

  const sortedMonths = [...monthKeys].sort();
  return sortedMonths.map((ym) => {
    const [yearStr, monthStr] = ym.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const label = MONTH_FORMATTER.format(new Date(year, month - 1, 1));
    const leading = weekdaySundayFirst(year, month, 1);
    const totalDays = daysInMonth(year, month);
    const days: CalendarDay[] = [];

    for (let i = 0; i < leading; i += 1) {
      days.push({ date: null, dayOfMonth: null, games: [] });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const date = isoKey(year, month, day);
      days.push({
        date,
        dayOfMonth: day,
        games: byDate.get(date) ?? [],
      });
    }

    while (days.length % 7 !== 0) {
      days.push({ date: null, dayOfMonth: null, games: [] });
    }

    return { key: ym, year, month, label, days };
  });
}
