import { useMemo } from 'react';
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { PlayersRadarResponse } from '../../types/api.compat';
import ChartSkeleton from '../skeletons/ChartSkeleton';
import { usePlayerCompareChartColors } from '../../hooks/usePlayerCompareChartColors';
import { buildCompareMetricRows } from '../../utils/playerCompareMetricRows';
import { polarAxisTickSans } from '../../utils/rechartsAxis';

function toRadarRows(
  payload: PlayersRadarResponse | null,
  group: 'hitting' | 'pitching',
): { metric: string; a: number; b: number }[] {
  return buildCompareMetricRows(payload, group).map(({ metric, a, b }) => ({
    metric,
    a,
    b,
  }));
}

type PlayerRadarProps = {
  /** When false, show the idle placeholder (no fetch in this component). */
  ready: boolean;
  data: PlayersRadarResponse | null;
  loading: boolean;
  error: Error | null;
  group?: 'hitting' | 'pitching';
  /** When set, radar uses that team’s primary; otherwise a fixed comparison pair. */
  teamId1?: number | null;
  teamId2?: number | null;
};

export default function PlayerRadar({
  ready,
  data,
  loading,
  error,
  group = 'hitting',
  teamId1,
  teamId2,
}: PlayerRadarProps) {
  const rows = useMemo(() => toRadarRows(data, group), [data, group]);

  const nameA = data?.players?.[0]?.fullName ?? 'Player A';
  const nameB = data?.players?.[1]?.fullName ?? 'Player B';

  const { colorA, colorB } = usePlayerCompareChartColors(teamId1, teamId2);

  if (!ready) {
    return <p className="muted">Enter two different MLB player IDs and a season to compare.</p>;
  }

  if (loading && !data) {
    return <ChartSkeleton height={420} label="Loading player comparison" />;
  }

  if (error) {
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  }

  if (!rows.length) {
    return <p className="muted">Not enough stat rows for a radar (empty season?).</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={420}>
      <RadarChart
        data={rows}
        cx="50%"
        cy="50%"
        outerRadius="72%"
        margin={{ top: 16, right: 24, bottom: 16, left: 24 }}
      >
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="metric" tick={polarAxisTickSans} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name={nameA}
          dataKey="a"
          stroke={colorA}
          fill={colorA}
          fillOpacity={0.35}
          isAnimationActive={false}
        />
        <Radar
          name={nameB}
          dataKey="b"
          stroke={colorB}
          fill={colorB}
          fillOpacity={0.22}
          isAnimationActive={false}
        />
        <Legend />
        <Tooltip
          contentStyle={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text-h)',
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
