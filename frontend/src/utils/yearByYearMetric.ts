import type { YearByYearMetric } from '../types/api.compat';

export const HITTING_CAREER_METRICS: {
  value: YearByYearMetric;
  label: string;
}[] = [
  { value: 'ops', label: 'OPS' },
  { value: 'avg', label: 'AVG' },
  { value: 'obp', label: 'OBP' },
  { value: 'slg', label: 'SLG' },
  { value: 'woba', label: 'wOBA' },
];

export const PITCHING_CAREER_METRICS: {
  value: YearByYearMetric;
  label: string;
}[] = [
  { value: 'era', label: 'ERA' },
  { value: 'whip', label: 'WHIP' },
  { value: 'k9', label: 'K/9' },
  { value: 'bb9', label: 'BB/9' },
  { value: 'fip', label: 'FIP' },
];

const SHORT: Record<YearByYearMetric, string> = {
  ops: 'OPS',
  avg: 'AVG',
  obp: 'OBP',
  slg: 'SLG',
  woba: 'wOBA',
  era: 'ERA',
  whip: 'WHIP',
  k9: 'K/9',
  bb9: 'BB/9',
  fip: 'FIP',
};

export function yearByYearMetricShortLabel(m: YearByYearMetric): string {
  return SHORT[m] ?? m;
}

/** Two decimals for pitching-style rates; three for batting averages / OPS family. */
export function formatYearByYearAxisValue(m: YearByYearMetric, v: number): string {
  if (m === 'k9' || m === 'bb9' || m === 'era' || m === 'whip' || m === 'fip') {
    return v.toFixed(2);
  }
  return v.toFixed(3);
}

export function formatYearByYearTooltipValue(
  m: YearByYearMetric,
  v: number | null | undefined,
): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return formatYearByYearAxisValue(m, v);
}
