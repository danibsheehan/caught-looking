import { describe, expect, it } from 'vitest';
import type { RecordTimelineResponse } from '../types/api.compat';
import {
  buildDivisionRaceChartRows,
  buildGamesBehindRows,
  buildRollingWinPctRows,
  buildSeasonWinPctRows,
  divisionRaceValueKey,
  maxGamesBehind,
} from './recordTimelineChart';

function pt(
  gameIndex: number,
  result: string,
  wins: number,
  losses: number,
  pct: number,
): RecordTimelineResponse['points'][number] {
  return {
    gameIndex,
    officialDate: `2026-04-${String(gameIndex).padStart(2, '0')}`,
    result,
    wins,
    losses,
    pct,
  };
}

const twoTeams: RecordTimelineResponse[] = [
  {
    teamId: 1,
    season: 2026,
    finishedGames: 4,
    points: [
      pt(1, 'W', 1, 0, 1),
      pt(2, 'W', 2, 0, 1),
      pt(3, 'L', 2, 1, 2 / 3),
      pt(4, 'W', 3, 1, 0.75),
    ],
  },
  {
    teamId: 2,
    season: 2026,
    finishedGames: 4,
    points: [
      pt(1, 'L', 0, 1, 0),
      pt(2, 'L', 0, 2, 0),
      pt(3, 'W', 1, 2, 1 / 3),
      pt(4, 'L', 1, 3, 0.25),
    ],
  },
];

describe('buildSeasonWinPctRows', () => {
  it('scales pct to 0–100 on a shared game axis', () => {
    const rows = buildSeasonWinPctRows(twoTeams);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      gameIndex: 1,
      [divisionRaceValueKey(1)]: 100,
      [divisionRaceValueKey(2)]: 0,
    });
    expect(rows[3]?.[divisionRaceValueKey(1)]).toBeCloseTo(75);
    expect(rows[3]?.[divisionRaceValueKey(2)]).toBeCloseTo(25);
  });
});

describe('buildGamesBehindRows', () => {
  it('puts the leader at 0 GB and trails others', () => {
    const rows = buildGamesBehindRows(twoTeams);
    expect(rows[0]?.[divisionRaceValueKey(1)]).toBe(0);
    expect(rows[0]?.[divisionRaceValueKey(2)]).toBe(1);
    // After 4: team1 3-1, team2 1-3 → GB = ((3-1)+(3-1))/2 = 2
    expect(rows[3]?.[divisionRaceValueKey(1)]).toBe(0);
    expect(rows[3]?.[divisionRaceValueKey(2)]).toBe(2);
  });

  it('exposes max GB for axis domain', () => {
    const rows = buildGamesBehindRows(twoTeams);
    expect(maxGamesBehind(rows, [1, 2])).toBe(2);
  });
});

describe('buildRollingWinPctRows', () => {
  it('uses a trailing window (L2 here)', () => {
    const rows = buildRollingWinPctRows(twoTeams, 2);
    // Team 1 games 3–4: L, W → 50%
    expect(rows[3]?.[divisionRaceValueKey(1)]).toBeCloseTo(50);
    // Team 2 games 3–4: W, L → 50%
    expect(rows[3]?.[divisionRaceValueKey(2)]).toBeCloseTo(50);
  });
});

describe('buildDivisionRaceChartRows', () => {
  it('dispatches by mode', () => {
    expect(buildDivisionRaceChartRows('season', twoTeams)[0]?.[divisionRaceValueKey(1)]).toBe(100);
    expect(buildDivisionRaceChartRows('race', twoTeams)[0]?.[divisionRaceValueKey(2)]).toBe(1);
    expect(buildDivisionRaceChartRows('recent', twoTeams, 2)[3]?.[divisionRaceValueKey(1)]).toBe(
      50,
    );
  });
});
