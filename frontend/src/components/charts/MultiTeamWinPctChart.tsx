import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartSkeleton from '../skeletons/ChartSkeleton';
import { useChartSurfaceHex } from '../../hooks/useChartSurfaceHex';
import { useRecordTimelinesBatch } from '../../hooks/useRecordTimelinesBatch';
import { obsidianTeamChartPairsRegistryPrimary } from '../../utils/mlbTeamColors';
import { chartCartesianTick } from '../../utils/rechartsAxis';

type MultiTeamWinPctChartProps = {
  /** Preserve **standings order** (e.g. division rank) for color assignment. */
  teamIds: number[];
  season: number | null | undefined;
  getLabel: (teamId: number) => string;
  /** Division leader + storyline (full opacity); others dimmed until hover. */
  heroTeamIds?: readonly number[];
};

function WinPctYAxisTick(
  props: Record<string, unknown> & {
    x?: number;
    y?: number;
    payload?: { value?: number | string };
  },
) {
  const { x = 0, y = 0, payload } = props;
  const v = payload?.value;
  const n = typeof v === 'number' ? v : Number(v);
  const isMid = n === 50;
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      fill={isMid ? 'var(--chart-y-mid-tick)' : 'var(--chart-tick)'}
      fontSize={11}
      fontFamily="var(--mono)"
    >
      {`${n}%`}
    </text>
  );
}

type WinPctTipEntry = {
  dataKey?: string | number;
  name?: string;
  value?: unknown;
  color?: string;
};

function WinPctDivisionTooltip({
  active,
  payload,
  label,
  getLabel,
}: {
  active?: boolean;
  label?: string | number;
  payload?: readonly WinPctTipEntry[];
  getLabel: (teamId: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const gameLabel = label != null && label !== '' ? `Game ${label}` : 'Game';
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: '0.35rem',
        padding: '0.45rem 0.6rem',
        fontSize: '0.82rem',
        boxShadow: 'var(--shadow)',
        color: 'var(--text-h)',
        minWidth: '10rem',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>{gameLabel}</div>
      {payload.map((entry) => {
        const key = String(entry.dataKey ?? '');
        const m = /^pct_(\d+)$/.exec(key);
        const teamId = m ? Number(m[1]) : null;
        const name = teamId != null ? getLabel(teamId) : ((entry.name as string) ?? 'Team');
        const v = entry.value;
        const pct = v != null && typeof v === 'number' ? `${v.toFixed(1)}%` : '—';
        return (
          <div
            key={key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '0.75rem',
              marginTop: '0.15rem',
              fontFamily: 'var(--mono)',
              fontSize: '0.8rem',
              color: 'var(--text)',
            }}
          >
            <span style={{ color: entry.color ?? 'var(--text-h)' }}>{name}</span>
            <span>{pct}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function MultiTeamWinPctChart({
  teamIds,
  season,
  getLabel,
  heroTeamIds = [],
}: MultiTeamWinPctChartProps) {
  const surfaceHex = useChartSurfaceHex();
  const [hoveredTeamId, setHoveredTeamId] = useState<number | null>(null);

  const { data: payload, error, loading, orderedIds } = useRecordTimelinesBatch(teamIds, season);

  const pairs = useMemo(
    () => obsidianTeamChartPairsRegistryPrimary(orderedIds, surfaceHex),
    [orderedIds, surfaceHex],
  );

  const pairById = useMemo(() => {
    const m = new Map<number, { ink: string; label: string }>();
    orderedIds.forEach((id, i) => {
      const p = pairs[i];
      if (p) m.set(id, p);
    });
    return m;
  }, [orderedIds, pairs]);

  const lastGameByTeamId = useMemo(() => {
    const m = new Map<number, number>();
    for (const tl of payload?.timelines ?? []) {
      const pts = tl.points;
      if (pts?.length) {
        const last = pts[pts.length - 1];
        if (last) m.set(tl.teamId, last.gameIndex);
      }
    }
    return m;
  }, [payload]);

  const heroSet = useMemo(() => new Set(heroTeamIds), [heroTeamIds]);

  const lineOpacity = (id: number) => {
    if (hoveredTeamId != null) {
      return hoveredTeamId === id ? 1 : 0.22;
    }
    if (heroTeamIds.length === 0) return 1;
    return heroSet.has(id) ? 1 : 0.5;
  };

  const lineStrokeWidth = (id: number) => {
    if (hoveredTeamId != null) {
      return hoveredTeamId === id ? 3 : 1.25;
    }
    if (heroTeamIds.length === 0) return 2;
    return heroSet.has(id) ? 2.5 : 1.5;
  };

  /** Division leader (first in {@link heroTeamIds}) draws last so the line sits on top. */
  const renderOrder = useMemo(() => {
    if (heroTeamIds.length === 0) return orderedIds;
    const hs = new Set(heroTeamIds);
    const non = orderedIds.filter((id) => !hs.has(id));
    const heroes = heroTeamIds.filter((id) => orderedIds.includes(id));
    const leader = heroes[0];
    const rest = heroes.slice(1);
    if (leader == null) return orderedIds;
    return [...non, ...rest, leader];
  }, [orderedIds, heroTeamIds]);

  const chartData = useMemo(() => {
    if (!payload?.timelines?.length) return [];
    let maxGames = 0;
    for (const tl of payload.timelines) {
      maxGames = Math.max(maxGames, tl.points?.length ?? 0);
    }
    const rows: Array<Record<string, number | undefined> & { gameIndex: number }> = [];
    for (let i = 1; i <= maxGames; i++) {
      const row: Record<string, number | undefined> & { gameIndex: number } = {
        gameIndex: i,
      };
      for (const tl of payload.timelines) {
        const pt = tl.points[i - 1];
        const key = `pct_${tl.teamId}`;
        if (pt) row[key] = pt.pct * 100;
      }
      rows.push(row);
    }
    return rows;
  }, [payload]);

  if (orderedIds.length === 0 || season == null) {
    return <p className="muted">Select a division with teams to compare win percentage curves.</p>;
  }

  if (loading && !payload) {
    return <ChartSkeleton height={360} label="Loading division win % timelines" />;
  }

  if (error) {
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  }

  if (!chartData.length) {
    return <p className="muted">No completed games in this sample yet.</p>;
  }

  return (
    <div onMouseLeave={() => setHoveredTeamId(null)}>
      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={chartData} margin={{ top: 10, right: 14, left: 4, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid-faint)" />
          <ReferenceLine y={50} stroke="var(--chart-y-mid)" strokeWidth={1} />
          <XAxis
            dataKey="gameIndex"
            tick={chartCartesianTick}
            label={{
              value: 'Game #',
              position: 'insideBottom',
              offset: -4,
              fill: 'var(--muted)',
              fontFamily: 'var(--sans)',
            }}
          />
          <YAxis domain={[0, 100]} tick={<WinPctYAxisTick />} width={48} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={(props) => (
              <WinPctDivisionTooltip
                active={props.active}
                payload={props.payload as readonly WinPctTipEntry[] | undefined}
                label={props.label}
                getLabel={getLabel}
              />
            )}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value: string) => {
              const id = orderedIds.find((tid) => getLabel(tid) === value);
              const col = id != null ? pairById.get(id)?.label : undefined;
              return <span style={{ color: col ?? 'var(--text)' }}>{value}</span>;
            }}
          />
          {renderOrder.map((id) => {
            const pair = pairById.get(id);
            const ink = pair?.ink ?? '#64748b';
            const label = pair?.label ?? '#c8d8e8';
            const lastG = lastGameByTeamId.get(id);
            return (
              <Line
                key={id}
                type="monotone"
                dataKey={`pct_${id}`}
                name={getLabel(id)}
                stroke={ink}
                strokeWidth={lineStrokeWidth(id)}
                strokeOpacity={lineOpacity(id)}
                dot={(dotProps: { cx?: number; cy?: number; payload?: { gameIndex: number } }) => {
                  const { cx, cy, payload } = dotProps;
                  if (cx == null || cy == null || payload == null || lastG == null) return null;
                  if (payload.gameIndex !== lastG) return null;
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={3.5}
                      fill={label}
                      stroke="var(--bg)"
                      strokeWidth={1}
                    />
                  );
                }}
                activeDot={{ r: 5, strokeWidth: 0, fill: label }}
                isAnimationActive={false}
                onMouseEnter={() => setHoveredTeamId(id)}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
