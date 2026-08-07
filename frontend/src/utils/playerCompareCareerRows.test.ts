import { describe, expect, it } from 'vitest';
import type { PlayersYearByYearResponse } from '../types/api.compat';
import { buildCareerLineChartRows, careerLineA11yRows } from './playerCompareCareerRows';

const sample: PlayersYearByYearResponse = {
  group: 'hitting',
  metric: 'ops',
  players: [
    {
      id: 1,
      fullName: 'A',
      points: [
        { season: 2023, value: 0.9 },
        { season: 2024, value: 0.95 },
      ],
    },
    {
      id: 2,
      fullName: 'B',
      points: [{ season: 2024, value: 0.88 }],
    },
  ],
  leagueBySeason: { '2023': 0.72, '2024': 0.71 },
};

describe('buildCareerLineChartRows', () => {
  it('returns empty for null payload', () => {
    expect(buildCareerLineChartRows(null)).toEqual([]);
  });

  it('unions seasons and fills nulls', () => {
    const rows = buildCareerLineChartRows(sample);
    expect(rows).toEqual([
      { season: 2023, a: 0.9, b: null, league: 0.72 },
      { season: 2024, a: 0.95, b: 0.88, league: 0.71 },
    ]);
  });
});

describe('careerLineA11yRows', () => {
  it('formats values for the a11y table', () => {
    const chartRows = buildCareerLineChartRows(sample);
    const { columns, rows } = careerLineA11yRows(chartRows, 'ops', 'A', 'B');
    expect(columns).toEqual(['Season', 'A', 'B', 'MLB avg (teams)']);
    expect(rows[0]).toEqual(['2023', '0.900', '—', '0.720']);
    expect(rows[1]).toEqual(['2024', '0.950', '0.880', '0.710']);
  });
});
