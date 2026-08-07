import { useMemo, type CSSProperties } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useChartSurfaceHex } from '../../hooks/useChartSurfaceHex';
import type { LeaderRow } from '../../types/api.compat';
import {
  CHART_NEUTRAL_FALLBACK,
  obsidianTeamChartPairsRegistryPrimary,
} from '../../utils/mlbTeamColors';
import { buildLeadersBarData, type LeadersBarDatum } from '../../utils/leadersBarData';
import { chartCartesianTick, polarAxisTickSans } from '../../utils/rechartsAxis';

type LeadersTop10BarProps = {
  leaders: readonly LeaderRow[];
  /** Human category label (e.g. "Home runs"). */
  categoryLabel: string;
  height?: number;
};

/**
 * Horizontal top-10 bars for the Leaders page. The visible HTML table below remains
 * the primary accessible data surface; this graphic is aria-hidden.
 */
export default function LeadersTop10Bar({
  leaders,
  categoryLabel,
  height = 360,
}: LeadersTop10BarProps) {
  const surfaceHex = useChartSurfaceHex();
  const data = useMemo(() => buildLeadersBarData(leaders), [leaders]);
  const pairs = useMemo(
    () =>
      obsidianTeamChartPairsRegistryPrimary(
        data.map((r) => r.teamId),
        surfaceHex,
      ),
    [data, surfaceHex],
  );

  if (data.length === 0) {
    return null;
  }

  const chartHeight = Math.max(height, 28 * data.length + 48);

  return (
    <div className="leaders-top10-bar chart-frame" aria-hidden="true">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart layout="vertical" data={data} margin={{ top: 8, right: 28, left: 4, bottom: 8 }}>
          <CartesianGrid
            strokeDasharray="3 4"
            stroke="var(--chart-grid-faint)"
            horizontal={false}
          />
          <XAxis type="number" tick={chartCartesianTick} domain={[0, 'auto']} />
          <YAxis
            type="category"
            dataKey="label"
            width={88}
            interval={0}
            tick={polarAxisTickSans}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip cursor={{ fill: 'var(--accent-bg)' }} content={LeadersBarTooltip} />
          <Bar
            dataKey="value"
            name={categoryLabel}
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
            isAnimationActive={false}
          >
            {data.map((row, i) => (
              <Cell
                key={`${row.rank}-${row.fullName}`}
                fill={pairs[i]?.ink ?? CHART_NEUTRAL_FALLBACK}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const tooltipBox: CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: '0.35rem',
  padding: '0.45rem 0.6rem',
  fontSize: '0.82rem',
  boxShadow: 'var(--shadow)',
  color: 'var(--text-h)',
};

function LeadersBarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as LeadersBarDatum | undefined;
  if (!row) return null;
  return (
    <div style={tooltipBox}>
      <div style={{ fontWeight: 600 }}>
        #{row.rank} {row.fullName}
      </div>
      <div style={{ marginTop: '0.2rem', color: 'var(--text)', fontFamily: 'var(--mono)' }}>
        {row.valueLabel}
        {row.teamName !== '—' ? ` · ${row.teamName}` : ''}
      </div>
    </div>
  );
}
