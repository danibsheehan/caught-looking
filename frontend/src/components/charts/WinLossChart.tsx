import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartSkeleton from '../skeletons/ChartSkeleton';
import { useChartSurfaceHex } from '../../hooks/useChartSurfaceHex';
import { useRecordTimeline } from '../../hooks/useRecordTimeline';
import { chartA11yFootnote, chartA11ySlice } from '../../utils/chartA11yRows';
import { chartCartesianTick } from '../../utils/rechartsAxis';
import { obsidianTeamChartPairs } from '../../utils/mlbTeamColors';
import ChartDataTable from './ChartDataTable';

type WinLossChartProps = {
  teamId: number | null | undefined;
  season: number | null | undefined;
};

export default function WinLossChart({ teamId, season }: WinLossChartProps) {
  const surfaceHex = useChartSurfaceHex();
  const { data, error, loading } = useRecordTimeline(teamId, season);

  const { strokeColor, peakLabelColor } = useMemo(() => {
    if (teamId == null || !Number.isFinite(teamId) || teamId <= 0) {
      return { strokeColor: '#64748b', peakLabelColor: '#94a3b8' };
    }
    const [pair] = obsidianTeamChartPairs([teamId], surfaceHex);
    return { strokeColor: pair!.ink, peakLabelColor: pair!.label };
  }, [teamId, surfaceHex]);

  const rows = useMemo(() => {
    if (!data?.points?.length) return [];
    return data.points.map((p) => ({
      ...p,
      pctLabel: `${(p.pct * 100).toFixed(1)}%`,
      pctPct: p.pct * 100,
      x: p.gameIndex,
    }));
  }, [data]);

  const a11y = useMemo(() => {
    const slice = chartA11ySlice(rows);
    return {
      rows: slice.rows.map((p) => [
        String(p.gameIndex),
        p.officialDate,
        p.result,
        `${p.wins}-${p.losses}`,
        p.pctLabel,
      ]),
      footnote: chartA11yFootnote('games', slice),
    };
  }, [rows]);

  if (teamId == null || season == null) {
    return <p className="muted">Select a team and season to plot rolling win percentage.</p>;
  }

  if (loading && !data) {
    return <ChartSkeleton height={360} label="Loading win percentage timeline" />;
  }

  if (error) {
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  }

  if (!rows.length) {
    return <p className="muted">No completed games in this sample yet.</p>;
  }

  const peakRow = rows.reduce((best, row) => (row.pctPct >= best.pctPct ? row : best));

  return (
    <div>
      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={rows} margin={{ top: 10, right: 10, left: 4, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="x"
              tick={chartCartesianTick}
              label={{
                value: 'Game #',
                position: 'insideBottom',
                offset: -4,
                fill: 'var(--muted)',
                fontSize: 11,
                fontFamily: 'var(--sans)',
              }}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={chartCartesianTick}
              width={48}
            />
            <Tooltip
              formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Win %']}
              labelFormatter={(_, p) => {
                const row = p?.[0]?.payload as
                  | {
                      gameIndex: number;
                      officialDate: string;
                      result: string;
                      wins: number;
                      losses: number;
                    }
                  | undefined;
                if (!row) return '';
                return `Game ${row.gameIndex} · ${row.officialDate} (${row.result}) · ${row.wins}-${row.losses}`;
              }}
              contentStyle={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text-h)',
              }}
            />
            <Line
              type="monotone"
              dataKey="pctPct"
              name="Win %"
              stroke={strokeColor}
              strokeWidth={2}
              dot={{ r: 2, strokeWidth: 0 }}
              isAnimationActive={false}
            />
            <ReferenceDot
              x={peakRow.x}
              y={peakRow.pctPct}
              r={4}
              fill={peakLabelColor}
              stroke="var(--bg)"
              strokeWidth={1}
              ifOverflow="extendDomain"
              label={{
                value: 'peak',
                position: 'top',
                fill: peakLabelColor,
                fontSize: 10,
                fontFamily: 'var(--mono)',
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ChartDataTable
        caption={`Rolling win percentage through ${season}.`}
        columns={['Game #', 'Date', 'Result', 'W-L', 'Win %']}
        rows={a11y.rows}
        footnote={a11y.footnote}
      />
    </div>
  );
}
