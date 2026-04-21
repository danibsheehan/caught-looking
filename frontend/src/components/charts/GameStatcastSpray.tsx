import { useId, useMemo, useState } from 'react'
import {
  getFieldDimensionsForVenue,
  type FieldDimensionsFt,
} from '../../data/mlbVenueFieldDimensions'
import {
  scaleSprayOutlinePoint,
  SPRAY_HOME,
  SPRAY_INFIELD,
  SPRAY_LF,
  SPRAY_OF_CONTROL,
  SPRAY_PLATE,
  SPRAY_RF,
} from '../../data/parkSprayOutline'
import type { StatcastBattedBall } from '../../types/api'
import { useChartSurfaceHex } from '../../hooks/useChartSurfaceHex'
import { inningHalfBucket } from '../../utils/inningHalf'
import { statcastHalfFillColors } from '../../utils/statcastHalfColors'

type SprayPoint = {
  hcX: number
  hcY: number
  playerName: string
  events?: string
  inningHalf?: string
  launchSpeed?: number
  launchAngle?: number
}

type GameStatcastSprayProps = {
  battedBalls: StatcastBattedBall[]
  venueId?: number
  venueName?: string
  awayTeamId?: number
  homeTeamId?: number
}

const W = 520
const H = 460
const PAD = { l: 40, r: 20, t: 22, b: 48 }

function toSprayPoints(rows: StatcastBattedBall[]): SprayPoint[] {
  const out: SprayPoint[] = []
  for (const r of rows) {
    if (r.hcX == null || r.hcY == null) continue
    out.push({
      hcX: r.hcX,
      hcY: r.hcY,
      playerName: r.playerName,
      events: r.events,
      inningHalf: r.inningHalf,
      launchSpeed: r.launchSpeed ?? undefined,
      launchAngle: r.launchAngle ?? undefined,
    })
  }
  return out
}

function extentWithPadding(
  vals: number[],
  padRatio: number,
  fallback: [number, number],
): [number, number] {
  if (vals.length === 0) return fallback
  let lo = Math.min(...vals)
  let hi = Math.max(...vals)
  if (lo === hi) {
    lo -= 1
    hi += 1
  }
  const span = hi - lo
  const pad = Math.max(span * padRatio, 8)
  return [lo - pad, hi + pad]
}

function pathFromPoints(
  sx: (x: number) => number,
  sy: (y: number) => number,
  pts: [number, number][],
  close: boolean,
): string {
  if (pts.length === 0) return ''
  const [x0, y0] = pts[0]
  let d = `M ${sx(x0).toFixed(2)} ${sy(y0).toFixed(2)}`
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i]
    d += ` L ${sx(x).toFixed(2)} ${sy(y).toFixed(2)}`
  }
  if (close) d += ' Z'
  return d
}

export default function GameStatcastSpray({
  battedBalls,
  venueId,
  venueName,
  awayTeamId,
  homeTeamId,
}: GameStatcastSprayProps) {
  const surfaceHex = useChartSurfaceHex()
  const gid = useId()
  const [tip, setTip] = useState<{
    px: number
    py: number
    lines: string[]
  } | null>(null)

  const points = useMemo(() => toSprayPoints(battedBalls), [battedBalls])

  const fieldDims: FieldDimensionsFt = useMemo(
    () => getFieldDimensionsForVenue(venueId),
    [venueId],
  )

  const scaledField = useMemo(() => {
    const d = fieldDims
    return {
      home: scaleSprayOutlinePoint(SPRAY_HOME, d),
      lf: scaleSprayOutlinePoint(SPRAY_LF, d),
      rf: scaleSprayOutlinePoint(SPRAY_RF, d),
      ofControl: scaleSprayOutlinePoint(SPRAY_OF_CONTROL, d),
      infield: SPRAY_INFIELD.map((p) => scaleSprayOutlinePoint(p, d)),
      plate: SPRAY_PLATE.map((p) => scaleSprayOutlinePoint(p, d)),
    }
  }, [fieldDims])

  const { sx, sy } = useMemo(() => {
    const outlineFlat: [number, number][] = [
      scaledField.home,
      scaledField.lf,
      scaledField.rf,
      scaledField.ofControl,
      ...scaledField.infield,
      ...scaledField.plate,
    ]
    const xs = [...outlineFlat.map((p) => p[0]), ...points.map((p) => p.hcX)]
    const ys = [...outlineFlat.map((p) => p[1]), ...points.map((p) => p.hcY)]
    const [x0, x1] = extentWithPadding(xs, 0.06, [35, 215])
    const [y0, y1] = extentWithPadding(ys, 0.05, [-28, 430])
    const plotW = W - PAD.l - PAD.r
    const plotH = H - PAD.t - PAD.b
    return {
      sx: (hx: number) => PAD.l + ((hx - x0) / (x1 - x0)) * plotW,
      sy: (hy: number) => PAD.t + ((y1 - hy) / (y1 - y0)) * plotH,
    }
  }, [points, scaledField])

  const { topHalf: topColor, bottomHalf: bottomColor, other: otherColor } = useMemo(
    () => statcastHalfFillColors(awayTeamId, homeTeamId, surfaceHex),
    [awayTeamId, homeTeamId, surfaceHex],
  )

  const fairPathD = useMemo(() => {
    const [hx, hy] = scaledField.home
    const [lx, ly] = scaledField.lf
    const [rx, ry] = scaledField.rf
    const [cx, cy] = scaledField.ofControl
    return `M ${sx(hx).toFixed(2)} ${sy(hy).toFixed(2)} L ${sx(lx).toFixed(2)} ${sy(ly).toFixed(2)} Q ${sx(cx).toFixed(2)} ${sy(cy).toFixed(2)} ${sx(rx).toFixed(2)} ${sy(ry).toFixed(2)} Z`
  }, [sx, sy, scaledField])

  const dirtPathD = useMemo(
    () => pathFromPoints(sx, sy, scaledField.infield, true),
    [sx, sy, scaledField.infield],
  )
  const platePathD = useMemo(
    () => pathFromPoints(sx, sy, scaledField.plate, true),
    [sx, sy, scaledField.plate],
  )

  const foulLeftD = useMemo(() => {
    const [hx, hy] = scaledField.home
    const [lx, ly] = scaledField.lf
    return `M ${sx(hx).toFixed(2)} ${sy(hy).toFixed(2)} L ${sx(lx).toFixed(2)} ${sy(ly).toFixed(2)}`
  }, [sx, sy, scaledField.home, scaledField.lf])

  const foulRightD = useMemo(() => {
    const [hx, hy] = scaledField.home
    const [rx, ry] = scaledField.rf
    return `M ${sx(hx).toFixed(2)} ${sy(hy).toFixed(2)} L ${sx(rx).toFixed(2)} ${sy(ry).toFixed(2)}`
  }, [sx, sy, scaledField.home, scaledField.rf])

  if (!points.length) {
    return (
      <p className="muted game-statcast-spray__empty">
        No hit-position data (hc_x / hc_y) for this game — spray chart needs tracking coordinates on
        batted balls.
      </p>
    )
  }

  return (
    <div className="game-statcast-spray">
      <p className="muted small game-statcast-spray__caption">
        {venueName ? (
          <>
            Fair-territory outline is scaled using published LF / CF / RF distances at{' '}
            <strong>{venueName}</strong> ({fieldDims.lf} / {fieldDims.cf} / {fieldDims.rf} ft). Hit
            dots use raw tracking coordinates in the same field space.
          </>
        ) : (
          <>
            Fair-territory outline uses a generic template ({fieldDims.lf} / {fieldDims.cf} /{' '}
            {fieldDims.rf} ft) — ballpark was not resolved from the schedule for this game.
          </>
        )}
      </p>
      <svg
        className="game-statcast-spray__svg"
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label="Spray chart: batted ball positions on the field"
      >
        <defs>
          <linearGradient id={`${gid}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--spray-sky-a)" />
            <stop offset="100%" stopColor="var(--spray-sky-b)" />
          </linearGradient>
          <radialGradient id={`${gid}-grass`} cx="50%" cy="92%" r="78%" fx="50%" fy="92%">
            <stop offset="0%" stopColor="var(--spray-grass-a)" />
            <stop offset="100%" stopColor="var(--spray-grass-b)" />
          </radialGradient>
          <linearGradient id={`${gid}-dirt`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--spray-dirt-a)" />
            <stop offset="100%" stopColor="var(--spray-dirt-b)" />
          </linearGradient>
        </defs>

        <rect width={W} height={H} fill={`url(#${gid}-sky)`} rx={6} />

        <path
          d={fairPathD}
          fill={`url(#${gid}-grass)`}
          stroke="var(--spray-edge)"
          strokeWidth={1.35}
          strokeLinejoin="round"
        />
        <path
          d={dirtPathD}
          fill={`url(#${gid}-dirt)`}
          stroke="var(--spray-dirt-b)"
          strokeWidth={1}
          strokeLinejoin="round"
          opacity={0.97}
        />

        <path
          d={foulLeftD}
          fill="none"
          stroke="var(--spray-chalk)"
          strokeWidth={2.75}
          strokeLinecap="round"
          opacity={0.95}
        />
        <path
          d={foulRightD}
          fill="none"
          stroke="var(--spray-chalk)"
          strokeWidth={2.75}
          strokeLinecap="round"
          opacity={0.95}
        />
        <path
          d={foulLeftD}
          fill="none"
          stroke="var(--spray-chalk-soft)"
          strokeWidth={1.1}
          strokeLinecap="round"
        />
        <path
          d={foulRightD}
          fill="none"
          stroke="var(--spray-chalk-soft)"
          strokeWidth={1.1}
          strokeLinecap="round"
        />

        <path
          d={platePathD}
          fill="var(--spray-plate)"
          stroke="var(--spray-plate-line)"
          strokeWidth={0.9}
          strokeLinejoin="round"
        />

        {points.map((p, i) => {
          let fill = otherColor
          switch (inningHalfBucket(p.inningHalf)) {
            case 'top':
              fill = topColor
              break
            case 'bottom':
              fill = bottomColor
              break
            default:
              break
          }
          const cx = sx(p.hcX)
          const cy = sy(p.hcY)
          const lines = [
            p.playerName,
            `${p.hcX.toFixed(0)} ft, ${p.hcY.toFixed(0)} ft (hc_x, hc_y)`,
            ...(p.launchSpeed != null && p.launchAngle != null
              ? [`${p.launchSpeed.toFixed(1)} mph · ${p.launchAngle.toFixed(1)}°`]
              : []),
            ...(p.events ? [p.events] : []),
          ]
          return (
            <circle
              key={`${p.hcX}-${p.hcY}-${i}`}
              cx={cx}
              cy={cy}
              r={5.25}
              fill={fill}
              stroke="var(--spray-bip-ring)"
              strokeWidth={1.5}
              style={{ cursor: 'default' }}
              onMouseEnter={() => setTip({ px: cx, py: cy, lines })}
              onMouseLeave={() => setTip(null)}
            />
          )
        })}

        <text
          x={W / 2}
          y={H - 12}
          textAnchor="middle"
          fill="var(--text)"
          fontSize={11}
          opacity={0.92}
        >
          Third base ← hc_x (ft) → First base · deeper contact toward top (hc_y)
        </text>
      </svg>

      {tip ? (
        <div
          className="game-statcast-spray__tooltip"
          style={{
            position: 'absolute',
            left: `${(tip.px / W) * 100}%`,
            top: `${(tip.py / H) * 100}%`,
            transform: 'translate(-50%, calc(-100% - 10px))',
          }}
        >
          {tip.lines.map((line, i) => (
            <div key={i} style={{ fontWeight: i === 0 ? 600 : 400 }}>
              {line}
            </div>
          ))}
        </div>
      ) : null}

      <ul className="game-statcast-spray__legend muted small" aria-hidden="true">
        <li>
          <span className="game-statcast-spray__swatch" style={{ background: topColor }} />
          Away batting
        </li>
        <li>
          <span className="game-statcast-spray__swatch" style={{ background: bottomColor }} />
          Home batting
        </li>
      </ul>
    </div>
  )
}
