import { describe, expect, it } from 'vitest';
import type { RecordPoint } from '../types/api.compat';
import {
  WEEKDAY_LABELS,
  buildRecordCalendarMonths,
  parseOfficialDate,
} from './recordTimelineCalendar';

function point(
  partial: Pick<RecordPoint, 'gameIndex' | 'officialDate' | 'result'> &
    Partial<Pick<RecordPoint, 'wins' | 'losses' | 'pct'>>,
): RecordPoint {
  return {
    wins: partial.wins ?? 0,
    losses: partial.losses ?? 0,
    pct: partial.pct ?? 0,
    ...partial,
  };
}

describe('parseOfficialDate', () => {
  it('parses ISO calendar dates', () => {
    expect(parseOfficialDate('2026-04-01')).toEqual({ year: 2026, month: 4, day: 1 });
  });

  it('rejects malformed dates', () => {
    expect(parseOfficialDate('04-01-2026')).toBeNull();
    expect(parseOfficialDate('')).toBeNull();
  });
});

describe('buildRecordCalendarMonths', () => {
  it('exposes Sunday-first weekday labels', () => {
    expect(WEEKDAY_LABELS[0]).toBe('Sun');
    expect(WEEKDAY_LABELS[6]).toBe('Sat');
  });

  it('builds month grids with padding and shared-date games', () => {
    const months = buildRecordCalendarMonths([
      point({ gameIndex: 1, officialDate: '2026-04-01', result: 'W', wins: 1, losses: 0, pct: 1 }),
      point({
        gameIndex: 2,
        officialDate: '2026-04-01',
        result: 'L',
        wins: 1,
        losses: 1,
        pct: 0.5,
      }),
      point({
        gameIndex: 3,
        officialDate: '2026-05-02',
        result: 'W',
        wins: 2,
        losses: 1,
        pct: 0.667,
      }),
    ]);

    expect(months.map((m) => m.key)).toEqual(['2026-04', '2026-05']);
    expect(months[0].label).toBe('April 2026');

    // 2026-04-01 is a Wednesday → 3 leading pads
    expect(months[0].days.slice(0, 3).every((d) => d.date === null)).toBe(true);
    const april1 = months[0].days.find((d) => d.date === '2026-04-01');
    expect(april1?.games.map((g) => g.result)).toEqual(['W', 'L']);

    const emptyDay = months[0].days.find((d) => d.date === '2026-04-02');
    expect(emptyDay?.games).toEqual([]);

    expect(months[0].days.length % 7).toBe(0);
    expect(months[1].days.length % 7).toBe(0);
  });

  it('skips unparseable dates', () => {
    const months = buildRecordCalendarMonths([
      point({ gameIndex: 1, officialDate: 'not-a-date', result: 'W' }),
      point({ gameIndex: 2, officialDate: '2026-06-15', result: 'L' }),
    ]);
    expect(months).toHaveLength(1);
    expect(months[0].key).toBe('2026-06');
  });
});
