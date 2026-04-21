import { useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import type { StatcastBattedBall } from '../../types/api'
import { useChartSurfaceHex } from '../../hooks/useChartSurfaceHex'
import { inningHalfBucket } from '../../utils/inningHalf'
import { statcastHalfFillColors } from '../../utils/statcastHalfColors'

export type GameStatcastScatterPoint = {
  launchAngle: number
  launchSpeed: number
  playerName: string
  events?: string
  inningHalf?: string
}

type GameStatcastScatterProps = {
  battedBalls: StatcastBattedBall[]
  /** When set, away batting uses this team color; otherwise a neutral palette. */
  awayTeamId?: number
  /** When set, home batting uses this team color. */
  homeTeamId?: number
}

function toPoints(rows: StatcastBattedBall[]): GameStatcastScatterPoint[] {
  const out: GameStatcastScatterPoint[] = []
  for (const r of rows) {
    if (r.launchSpeed == null || r.launchAngle == null) continue
    out.push({
      launchAngle: r.launchAngle,
      launchSpeed: r.launchSpeed,
      playerName: r.playerName,
      events: r.events,
      inningHalf: r.inningHalf,
    })
  }
  return out
}

export default function GameStatcastScatter({
  battedBalls,
  awayTeamId,
  homeTeamId,
}: GameStatcastScatterProps) {
  const surfaceHex = useChartSurfaceHex()

  const { points, top, bottom, other, xDomain, yDomain } = useMemo(() => {
    const all = toPoints(battedBalls)
    const topBat: GameStatcastScatterPoint[] = []
    const botBat: GameStatcastScatterPoint[] = []
    const other: GameStatcastScatterPoint[] = []
    for (const p of all) {
      switch (inningHalfBucket(p.inningHalf)) {
        case 'top':
          topBat.push(p)
          break
        case 'bottom':
          botBat.push(p)
          break
        default:
          other.push(p)
      }
    }
    const la = all.map((p) => p.launchAngle)
    const ev = all.map((p) => p.launchSpeed)
    const laMin = la.length ? Math.min(...la) : -30
    const laMax = la.length ? Math.max(...la) : 50
    const evMin = ev.length ? Math.min(...ev) : 50
    const evMax = ev.length ? Math.max(...ev) : 110
    const laPad = Math.max(5, (laMax - laMin) * 0.08)
    const evPad = Math.max(4, (evMax - evMin) * 0.06)
    return {
      points: all,
      top: topBat,
      bottom: botBat,
      other,
      xDomain: [Math.floor(laMin - laPad), Math.ceil(laMax + laPad)] as [number, number],
      yDomain: [Math.max(30, Math.floor(evMin - evPad)), Math.ceil(evMax + evPad)] as [
        number,
        number,
      ],
    }
  }, [battedBalls])

  const { topHalf: topColor, bottomHalf: bottomColor, other: otherColor } = useMemo(
    () => statcastHalfFillColors(awayTeamId, homeTeamId, surfaceHex),
    [awayTeamId, homeTeamId, surfaceHex],
  )

  if (!points.length) {
    return (
      <p className="muted game-statcast-scatter__empty">
        No tracked batted balls with launch data for this game (or data not available yet).
      </p>
    )
  }

  return (
    <div className="game-statcast-scatter">
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 10, right: 12, left: 4, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            type="number"
            dataKey="launchAngle"
            name="Launch angle"
            domain={xDomain}
            tick={{ fill: 'var(--text)', fontSize: 11 }}
            label={{
              value: 'Launch angle (°)',
              position: 'insideBottom',
              offset: -4,
              fill: 'var(--text)',
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="launchSpeed"
            name="Exit velo"
            domain={yDomain}
            tick={{ fill: 'var(--text)', fontSize: 11 }}
            width={44}
            label={{
              value: 'Exit velocity (mph)',
              angle: -90,
              position: 'insideLeft',
              fill: 'var(--text)',
              fontSize: 11,
            }}
          />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={StatcastTooltip} />
          <Legend
            wrapperStyle={{ fontSize: '0.82rem', paddingTop: 6 }}
            formatter={(value) => <span style={{ color: 'var(--text)' }}>{value}</span>}
          />
          {top.length > 0 ? (
            <Scatter name="Away batting" data={top} fill={topColor} />
          ) : null}
          {bottom.length > 0 ? (
            <Scatter name="Home batting" data={bottom} fill={bottomColor} />
          ) : null}
          {other.length > 0 ? (
            <Scatter name="Inning half unknown" data={other} fill={otherColor} />
          ) : null}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

function StatcastTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as GameStatcastScatterPoint | undefined
  if (!row) return null
  return (
    <div
      className="game-statcast-scatter__tooltip"
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        color: 'var(--text-h)',
        padding: '0.45rem 0.6rem',
        borderRadius: '0.35rem',
        fontSize: '0.82rem',
        boxShadow: 'var(--shadow)',
      }}
    >
      <div style={{ fontWeight: 600 }}>{row.playerName}</div>
      <div style={{ marginTop: '0.2rem', color: 'var(--text)' }}>
        {row.launchSpeed.toFixed(1)} mph · {row.launchAngle.toFixed(1)}°
        {row.events ? ` · ${row.events}` : ''}
      </div>
    </div>
  )
}
