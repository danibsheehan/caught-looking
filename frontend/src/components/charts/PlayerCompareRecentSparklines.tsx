import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipValueType,
} from 'recharts';
import type { GameLogPlayer, PlayersGameLogResponse } from '../../types/api.compat';
import ChartDataTable from './ChartDataTable';
import { usePlayerCompareChartColors } from '../../hooks/usePlayerCompareChartColors';
import { chartCartesianTick } from '../../utils/rechartsAxis';
import { rollingTrailingMean } from '../../utils/rollingMean';

const ROLLING_OPTIONS = [3, 5, 10, 15] as const;

function gamesToRows(games: GameLogPlayer['games'], key: 'a' | 'b', rollingWindow: number) {
  const vals = games.map((g) => g.value);
  const roll = rollingTrailingMean(vals, rollingWindow);
  return games.map((g, i) => ({
    i: i + 1,
    [key]: g.value,
    [`${key}Roll`]: roll[i],
    date: g.date,
  }));
}

function SparkBlock({
  title,
  rows,
  dataKey,
  rollKey,
  name,
  color,
  metric,
  leagueBaseline,
}: {
  title: string;
  rows: {
    i: number;
    date: string;
    a?: number;
    b?: number;
    aRoll?: number;
    bRoll?: number;
  }[];
  dataKey: 'a' | 'b';
  rollKey: 'aRoll' | 'bRoll';
  name: string;
  color: string;
  metric: 'ops' | 'era';
  leagueBaseline: number;
}) {
  const fmt = (v: number | undefined) =>
    v == null || !Number.isFinite(v) ? '—' : metric === 'ops' ? v.toFixed(3) : v.toFixed(2);

  const statLabel = metric === 'ops' ? 'Game OPS' : 'Game ERA';
  const a11yRows = rows.map((r) => [String(r.i), r.date, fmt(r[dataKey]), fmt(r[rollKey])]);

  return (
    <div className="player-game-spark__block">
      <div className="player-game-spark__head">
        <span className="player-game-spark__title">{title}</span>
        <span className="text text--muted text--small">{name}</span>
      </div>
      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={160}>
          <LineChart
            data={rows}
            margin={{ top: 6, right: 8, left: 0, bottom: 0 }}
            accessibilityLayer={false}
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="i"
              tick={{ ...chartCartesianTick, fontSize: 10 }}
              label={{
                value: 'Recent games (chronological)',
                position: 'insideBottom',
                offset: -2,
                fill: 'var(--muted)',
                fontSize: 10,
                fontFamily: 'var(--sans)',
              }}
            />
            <YAxis
              tick={{ ...chartCartesianTick, fontSize: 10 }}
              width={36}
              domain={['auto', 'auto']}
            />
            {leagueBaseline > 0 ? (
              <ReferenceLine
                y={leagueBaseline}
                stroke="var(--muted)"
                strokeDasharray="5 4"
                strokeWidth={1.5}
                label={{
                  value: metric === 'ops' ? 'Lg avg' : 'Lg ERA',
                  fill: 'var(--muted)',
                  fontSize: 10,
                  position: 'insideTopRight',
                  fontFamily: 'var(--sans)',
                }}
              />
            ) : null}
            <Tooltip
              contentStyle={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                fontSize: 11,
              }}
              formatter={(v: TooltipValueType | undefined, name: string | number | undefined) => [
                fmt(typeof v === 'number' ? v : undefined),
                String(name ?? ''),
              ]}
              labelFormatter={(_lab, payload) => {
                const row = payload?.[0]?.payload as { date?: string } | undefined;
                return row?.date ? `Game · ${row.date}` : 'Game';
              }}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 2 }}
              name={metric === 'ops' ? 'Game OPS' : 'Game ERA'}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey={rollKey}
              stroke={color}
              strokeWidth={2}
              strokeOpacity={0.55}
              strokeDasharray="6 4"
              dot={false}
              name="Rolling avg"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ChartDataTable
        caption={`${title} — ${name}: recent games.`}
        columns={['Game #', 'Date', statLabel, 'Rolling avg']}
        rows={a11yRows}
      />
    </div>
  );
}

type Props = {
  data: PlayersGameLogResponse;
  teamId1?: number | null;
  teamId2?: number | null;
};

export default function PlayerCompareRecentSparklines({ data, teamId1, teamId2 }: Props) {
  const { colorA, colorB } = usePlayerCompareChartColors(teamId1, teamId2);
  const [rollingWindow, setRollingWindow] = useState<(typeof ROLLING_OPTIONS)[number]>(10);
  const [p1, p2] = data.players;
  const metric = data.metric;
  const lb = data.leagueBaseline;

  const rowsA = useMemo(
    () => gamesToRows(p1?.games ?? [], 'a', rollingWindow),
    [p1?.games, rollingWindow],
  );
  const rowsB = useMemo(
    () => gamesToRows(p2?.games ?? [], 'b', rollingWindow),
    [p2?.games, rollingWindow],
  );

  if (!rowsA.length && !rowsB.length) {
    return (
      <p className="text text--muted">No game log for this season yet (or player did not play).</p>
    );
  }

  return (
    <div className="player-game-spark">
      <div className="player-game-spark__rolling-toolbar">
        <label className="player-game-spark__rolling-label" htmlFor="player-compare-rolling-window">
          Rolling average window
        </label>
        <select
          id="player-compare-rolling-window"
          className="player-game-spark__rolling-select players-compare__select"
          value={rollingWindow}
          onChange={(e) =>
            setRollingWindow(Number(e.target.value) as (typeof ROLLING_OPTIONS)[number])
          }
        >
          {ROLLING_OPTIONS.map((n) => (
            <option key={n} value={n}>
              Last {n} games
            </option>
          ))}
        </select>
        <span className="text text--muted text--small player-game-spark__rolling-hint">
          Solid: per-game {metric.toUpperCase()}. Dashed: trailing mean over the window.
        </span>
      </div>
      {rowsA.length > 0 ? (
        <SparkBlock
          title="Player 1"
          rows={rowsA}
          dataKey="a"
          rollKey="aRoll"
          name={p1?.fullName ?? 'A'}
          color={colorA}
          metric={metric}
          leagueBaseline={lb}
        />
      ) : null}
      {rowsB.length > 0 ? (
        <SparkBlock
          title="Player 2"
          rows={rowsB}
          dataKey="b"
          rollKey="bRoll"
          name={p2?.fullName ?? 'B'}
          color={colorB}
          metric={metric}
          leagueBaseline={lb}
        />
      ) : null}
    </div>
  );
}
