import type { PlayersYearByYearResponse, YearByYearMetric } from '../types/api.compat';
import { formatYearByYearTooltipValue } from './yearByYearMetric';

export type CareerLineChartRow = {
  season: number;
  a: number | null;
  b: number | null;
  league: number | null;
};

export function buildCareerLineChartRows(
  payload: PlayersYearByYearResponse | null,
): CareerLineChartRow[] {
  if (!payload?.players?.length) return [];
  const [p1, p2] = payload.players;
  const seasons = new Set<number>();
  for (const pt of p1.points ?? []) seasons.add(pt.season);
  for (const pt of p2.points ?? []) seasons.add(pt.season);
  const sorted = [...seasons].sort((x, y) => x - y);
  return sorted.map((season) => ({
    season,
    a: p1.points?.find((x) => x.season === season)?.value ?? null,
    b: p2.points?.find((x) => x.season === season)?.value ?? null,
    league: payload.leagueBySeason[String(season)] ?? null,
  }));
}

/** Visually-hidden table rows for year-by-year career lines. */
export function careerLineA11yRows(
  rows: readonly CareerLineChartRow[],
  metric: YearByYearMetric,
  nameA: string,
  nameB: string,
): { columns: [string, string, string, string]; rows: string[][] } {
  return {
    columns: ['Season', nameA, nameB, 'MLB avg (teams)'],
    rows: rows.map((r) => [
      String(r.season),
      formatYearByYearTooltipValue(metric, r.a),
      formatYearByYearTooltipValue(metric, r.b),
      formatYearByYearTooltipValue(metric, r.league),
    ]),
  };
}
