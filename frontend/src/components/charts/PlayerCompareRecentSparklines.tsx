import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { GameLogPlayer, PlayersGameLogResponse } from '../../types/api'
import { usePlayerCompareChartColors } from '../../hooks/usePlayerCompareChartColors'

function gamesToRows(games: GameLogPlayer['games'], key: 'a' | 'b') {
  return games.map((g, i) => ({
    i: i + 1,
    [key]: g.value,
    date: g.date,
  }))
}

function SparkBlock({
  title,
  rows,
  dataKey,
  name,
  color,
  metric,
  leagueBaseline,
}: {
  title: string
  rows: { i: number; date: string; a?: number; b?: number }[]
  dataKey: 'a' | 'b'
  name: string
  color: string
  metric: 'ops' | 'era'
  leagueBaseline: number
}) {
  const fmt = (v: number | undefined) =>
    v == null || !Number.isFinite(v)
      ? '—'
      : metric === 'ops'
        ? v.toFixed(3)
        : v.toFixed(2)

  return (
    <div className="player-spark-block">
      <div className="player-spark-block-head">
        <span className="player-spark-block-title">{title}</span>
        <span className="muted small">{name}</span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={rows} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="i"
            tick={{ fill: 'var(--text)', fontSize: 10 }}
            label={{
              value: 'Recent games (chronological)',
              position: 'insideBottom',
              offset: -2,
              fill: 'var(--muted)',
              fontSize: 10,
            }}
          />
          <YAxis
            tick={{ fill: 'var(--text)', fontSize: 10 }}
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
              }}
            />
          ) : null}
          <Tooltip
            contentStyle={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              fontSize: 11,
            }}
            formatter={(v: number | undefined) => [fmt(v), metric.toUpperCase()]}
            labelFormatter={(_lab, payload) => {
              const row = payload?.[0]?.payload as { date?: string } | undefined
              return row?.date ? `Game · ${row.date}` : 'Game'
            }}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={{ r: 2 }}
            name={name}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

type Props = {
  data: PlayersGameLogResponse
  teamId1?: number | null
  teamId2?: number | null
}

export default function PlayerCompareRecentSparklines({
  data,
  teamId1,
  teamId2,
}: Props) {
  const { colorA, colorB } = usePlayerCompareChartColors(teamId1, teamId2)
  const [p1, p2] = data.players
  const metric = data.metric
  const lb = data.leagueBaseline

  const rowsA = useMemo(
    () => gamesToRows(p1?.games ?? [], 'a'),
    [p1?.games],
  )
  const rowsB = useMemo(
    () => gamesToRows(p2?.games ?? [], 'b'),
    [p2?.games],
  )

  if (!rowsA.length && !rowsB.length) {
    return (
      <p className="muted">No game log for this season yet (or player did not play).</p>
    )
  }

  return (
    <div className="player-spark-grid">
      {rowsA.length > 0 ? (
        <SparkBlock
          title="Player 1"
          rows={rowsA}
          dataKey="a"
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
          name={p2?.fullName ?? 'B'}
          color={colorB}
          metric={metric}
          leagueBaseline={lb}
        />
      ) : null}
    </div>
  )
}
