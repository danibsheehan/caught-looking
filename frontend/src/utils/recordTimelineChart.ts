import type { RecordPoint, RecordTimelineResponse } from '../types/api.compat';

/** Chart modes for division race timelines. */
export type DivisionRaceChartMode = 'season' | 'race' | 'recent';

/** Trailing window for Recent mode Y values (last N decided games). */
export const DIVISION_RACE_RECENT_WINDOW = 10;

/**
 * How many completed games Race / Recent show on the X-axis.
 * Keeps late-season charts readable instead of stretching across ~162 games.
 */
export const DIVISION_RACE_X_WINDOW = 40;

export type DivisionRaceChartRow = Record<string, number | undefined> & {
  gameIndex: number;
};

function valueKey(teamId: number): string {
  return `v_${teamId}`;
}

function maxGameCount(timelines: readonly RecordTimelineResponse[]): number {
  let max = 0;
  for (const tl of timelines) {
    max = Math.max(max, tl.points?.length ?? 0);
  }
  return max;
}

/** Cumulative season win % (0–100) aligned on shared game index. */
export function buildSeasonWinPctRows(
  timelines: readonly RecordTimelineResponse[],
): DivisionRaceChartRow[] {
  const maxGames = maxGameCount(timelines);
  const rows: DivisionRaceChartRow[] = [];
  for (let i = 1; i <= maxGames; i++) {
    const row: DivisionRaceChartRow = { gameIndex: i };
    for (const tl of timelines) {
      const pt = tl.points?.[i - 1];
      if (pt) row[valueKey(tl.teamId)] = pt.pct * 100;
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Games behind the pace leader at each shared game index.
 * Leader = best win% among clubs that have completed that many games;
 * GB = ((LW − TW) + (TL − LL)) / 2.
 */
export function buildGamesBehindRows(
  timelines: readonly RecordTimelineResponse[],
): DivisionRaceChartRow[] {
  const maxGames = maxGameCount(timelines);
  const rows: DivisionRaceChartRow[] = [];
  for (let i = 1; i <= maxGames; i++) {
    const row: DivisionRaceChartRow = { gameIndex: i };
    const atIndex: Array<{ teamId: number; wins: number; losses: number; pct: number }> = [];
    for (const tl of timelines) {
      const pt = tl.points?.[i - 1];
      if (!pt) continue;
      atIndex.push({
        teamId: tl.teamId,
        wins: pt.wins,
        losses: pt.losses,
        pct: pt.pct,
      });
    }
    if (atIndex.length === 0) {
      rows.push(row);
      continue;
    }
    atIndex.sort((a, b) => {
      if (b.pct !== a.pct) return b.pct - a.pct;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.losses - b.losses;
    });
    const leader = atIndex[0]!;
    for (const t of atIndex) {
      const gb = (leader.wins - t.wins + (t.losses - leader.losses)) / 2;
      row[valueKey(t.teamId)] = gb;
    }
    rows.push(row);
  }
  return rows;
}

function rollingWinPct(
  points: readonly RecordPoint[],
  endExclusive: number,
  window: number,
): number | undefined {
  const w = Math.max(1, Math.floor(window));
  const start = Math.max(0, endExclusive - w);
  let wins = 0;
  let losses = 0;
  for (let j = start; j < endExclusive; j++) {
    const pt = points[j];
    if (!pt) continue;
    if (pt.result === 'W') wins += 1;
    else if (pt.result === 'L') losses += 1;
  }
  const decided = wins + losses;
  if (decided === 0) return undefined;
  return (wins / decided) * 100;
}

/** Trailing win % over the last `window` games (shorter early in the season). */
export function buildRollingWinPctRows(
  timelines: readonly RecordTimelineResponse[],
  window: number = DIVISION_RACE_RECENT_WINDOW,
): DivisionRaceChartRow[] {
  const maxGames = maxGameCount(timelines);
  const rows: DivisionRaceChartRow[] = [];
  for (let i = 1; i <= maxGames; i++) {
    const row: DivisionRaceChartRow = { gameIndex: i };
    for (const tl of timelines) {
      const pts = tl.points ?? [];
      if (pts.length < i) continue;
      const pct = rollingWinPct(pts, i, window);
      if (pct != null) row[valueKey(tl.teamId)] = pct;
    }
    rows.push(row);
  }
  return rows;
}

export function buildDivisionRaceChartRows(
  mode: DivisionRaceChartMode,
  timelines: readonly RecordTimelineResponse[],
  recentWindow: number = DIVISION_RACE_RECENT_WINDOW,
  xWindow: number = DIVISION_RACE_X_WINDOW,
): DivisionRaceChartRow[] {
  let rows: DivisionRaceChartRow[];
  switch (mode) {
    case 'race':
      rows = buildGamesBehindRows(timelines);
      break;
    case 'recent':
      rows = buildRollingWinPctRows(timelines, recentWindow);
      break;
    case 'season':
    default:
      return buildSeasonWinPctRows(timelines);
  }
  return sliceTrailingGameRows(rows, xWindow);
}

/** Keep the last `window` rows (by game index order). No-op when shorter. */
export function sliceTrailingGameRows(
  rows: readonly DivisionRaceChartRow[],
  window: number = DIVISION_RACE_X_WINDOW,
): DivisionRaceChartRow[] {
  const w = Math.max(1, Math.floor(window));
  if (rows.length <= w) return [...rows];
  return rows.slice(rows.length - w);
}

export function divisionRaceValueKey(teamId: number): string {
  return valueKey(teamId);
}

/** Max GB across rows (for Y domain); 0 when empty. */
export function maxGamesBehind(
  rows: readonly DivisionRaceChartRow[],
  teamIds: readonly number[],
): number {
  let max = 0;
  for (const row of rows) {
    for (const id of teamIds) {
      const v = row[valueKey(id)];
      if (typeof v === 'number' && v > max) max = v;
    }
  }
  return max;
}
