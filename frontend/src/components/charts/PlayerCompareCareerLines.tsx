import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipValueType,
} from 'recharts';
import type { PlayersYearByYearResponse } from '../../types/api.compat';
import { usePlayerCompareChartColors } from '../../hooks/usePlayerCompareChartColors';
import { buildCareerLineChartRows, careerLineA11yRows } from '../../utils/playerCompareCareerRows';
import {
  formatYearByYearAxisValue,
  formatYearByYearTooltipValue,
  yearByYearMetricShortLabel,
} from '../../utils/yearByYearMetric';
import { chartCartesianTick } from '../../utils/rechartsAxis';
import ChartDataTable from './ChartDataTable';

type Props = {
  data: PlayersYearByYearResponse;
  teamId1?: number | null;
  teamId2?: number | null;
};

export default function PlayerCompareCareerLines({ data, teamId1, teamId2 }: Props) {
  const rows = useMemo(() => buildCareerLineChartRows(data), [data]);
  const { colorA, colorB } = usePlayerCompareChartColors(teamId1, teamId2);
  const [pa, pb] = data.players;
  const nameA = pa?.fullName ?? 'Player 1';
  const nameB = pb?.fullName ?? 'Player 2';
  const metric = data.metric;
  const axisTitle = yearByYearMetricShortLabel(metric);
  const leagueColor = 'var(--muted)';
  const a11y = useMemo(
    () => careerLineA11yRows(rows, metric, nameA, nameB),
    [rows, metric, nameA, nameB],
  );

  if (!rows.length) {
    return <p className="text text--muted">No year-by-year data for this comparison.</p>;
  }

  return (
    <div>
      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="season" tick={chartCartesianTick} tickFormatter={(s) => String(s)} />
            <YAxis
              tick={chartCartesianTick}
              domain={['auto', 'auto']}
              tickFormatter={(v) => formatYearByYearAxisValue(metric, Number(v))}
              label={{
                value: axisTitle,
                angle: -90,
                position: 'insideLeft',
                fill: 'var(--muted)',
                fontSize: 11,
                fontFamily: 'var(--sans)',
              }}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text-h)',
              }}
              formatter={(
                value: TooltipValueType | undefined,
                name: string | number | undefined,
              ) => [
                formatYearByYearTooltipValue(metric, typeof value === 'number' ? value : null),
                String(name ?? ''),
              ]}
              labelFormatter={(s) => `Season ${s}`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="league"
              name="MLB avg (teams)"
              stroke={leagueColor}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="a"
              name={nameA}
              stroke={colorA}
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="b"
              name={nameB}
              stroke={colorB}
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ChartDataTable
        caption={`Year-by-year ${axisTitle} for ${nameA} and ${nameB}.`}
        columns={a11y.columns}
        rows={a11y.rows}
      />
    </div>
  );
}
