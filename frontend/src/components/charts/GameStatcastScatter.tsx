import { useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
  ReferenceArea,
  ReferenceLine,
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
import { buildScatterTooltipRows } from '../../utils/statcastDisplay'
import { inningHalfBucket } from '../../utils/inningHalf'
import { statcastHalfFillColors } from '../../utils/statcastHalfColors'
import StatcastMetricTooltipContent from './StatcastMetricTooltipContent'
import { StatcastScatterShapeCircle, StatcastScatterShapeDiamond } from './statcastMarkers'
import {
  type LaunchAngleBandKey,
  launchAngleBandSlices,
} from '../../utils/statcastLaunchAngleBands'

const LA_BAND_FILL: Record<LaunchAngleBandKey, string> = {
  grounder: 'var(--statcast-la-grounder)',
  line_drive: 'var(--statcast-la-linedrive)',
  fly_ball: 'var(--statcast-la-fly)',
}

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

  const { points, top, bottom, other, xDomain, yDomain, launchAngleBands } = useMemo(() => {
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
    const xDomain = [Math.floor(laMin - laPad), Math.ceil(laMax + laPad)] as [number, number]
    return {
      points: all,
      top: topBat,
      bottom: botBat,
      other,
      xDomain,
      yDomain: [Math.max(30, Math.floor(evMin - evPad)), Math.ceil(evMax + evPad)] as [
        number,
        number,
      ],
      launchAngleBands: launchAngleBandSlices(xDomain),
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

  const showLevelReference = xDomain[0] < 0 && xDomain[1] > 0

  return (
    <div className="game-statcast-scatter">
      <p className="muted small game-statcast-scatter__caption">
        Each point is one batted ball. Tinted bands mark typical grounder, line drive, and fly-ball
        launch-angle ranges (see key below). Read left to right as more lofted contact; read bottom
        to top as harder-hit contact. Hover a point for the batter and play result—where the ball
        went on the field is on the spray chart.
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 10, right: 12, left: 4, bottom: 28 }}>
          {launchAngleBands.map((b) => (
            <ReferenceArea
              key={b.key}
              x1={b.x1}
              x2={b.x2}
              y1={yDomain[0]}
              y2={yDomain[1]}
              fill={LA_BAND_FILL[b.key]}
              stroke="none"
            />
          ))}
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
          {showLevelReference ? (
            <ReferenceLine
              x={0}
              stroke="var(--border)"
              strokeDasharray="4 4"
              strokeOpacity={0.85}
            />
          ) : null}
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={StatcastTooltip} />
          <Legend
            wrapperStyle={{ fontSize: '0.82rem', paddingTop: 6 }}
            formatter={(value) => <span style={{ color: 'var(--text)' }}>{value}</span>}
          />
          {top.length > 0 ? (
            <Scatter
              name="Away — blue (circles)"
              data={top}
              fill={topColor}
              shape={StatcastScatterShapeCircle}
            />
          ) : null}
          {bottom.length > 0 ? (
            <Scatter
              name="Home — orange (diamonds)"
              data={bottom}
              fill={bottomColor}
              shape={StatcastScatterShapeDiamond}
            />
          ) : null}
          {other.length > 0 ? (
            <Scatter name="Inning half unknown" data={other} fill={otherColor} />
          ) : null}
        </ScatterChart>
      </ResponsiveContainer>
      <ul className="game-statcast-scatter__band-legend muted small" aria-hidden="true">
        <li>
          <span
            className="game-statcast-scatter__band-swatch game-statcast-scatter__band-swatch--grounder"
          />
          Grounder (&lt;10°)
        </li>
        <li>
          <span
            className="game-statcast-scatter__band-swatch game-statcast-scatter__band-swatch--linedrive"
          />
          Line drive (10°–25°)
        </li>
        <li>
          <span className="game-statcast-scatter__band-swatch game-statcast-scatter__band-swatch--fly" />
          Fly ball (&gt;25°)
        </li>
      </ul>
    </div>
  )
}

function StatcastTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as GameStatcastScatterPoint | undefined
  if (!row) return null
  const rows = buildScatterTooltipRows({
    playerName: row.playerName,
    launchSpeed: row.launchSpeed,
    launchAngle: row.launchAngle,
    events: row.events,
  })
  return (
    <div className="game-statcast-scatter__tooltip statcast-metric-tooltip">
      <StatcastMetricTooltipContent rows={rows} />
    </div>
  )
}
