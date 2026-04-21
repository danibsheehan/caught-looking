import { useId, useMemo, useState } from 'react'
import {
  getFieldDimensionsForVenue,
  type FieldDimensionsFt,
} from '../../data/mlbVenueFieldDimensions'
import { buildSprayFenceGeometry } from '../../data/parkSprayOutline'
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

/** ViewBox size (px); larger than v1 so the field reads bigger in the game panel. */
const W = 620
const H = 548
const PAD = { l: 40, r: 40, t: 22, b: 48 }
/** Inset inside the plot rect before fitting; keeps field art off the chart border. */
const PLOT_INSET_PX = 24
/**
 * Even with isotropic scale, width-tied fits can use 100% of the plot width, so the fair wedge
 * (and infield) read flush to the sides. Cap how much horizontal span the data may occupy so
 * there is always visible margin (similar to Savant’s field diagrams).
 */
const MAX_FIELD_WIDTH_FRAC = 0.78

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

const EXTENT_PAD_X = 0.06
const EXTENT_PAD_Y = 0.05

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
    const fence = buildSprayFenceGeometry(d)
    return {
      fence,
      ofControl: fence.cf,
      plate: fence.plate,
    }
  }, [fieldDims])

  const { sx, sy, pxPerFt } = useMemo(() => {
    const { fence } = scaledField
    const outlineFlat: [number, number][] = [
      fence.home,
      fence.lf,
      fence.lcf,
      fence.cf,
      fence.rcf,
      fence.rf,
      ...fence.infieldGrass,
      ...fence.infieldDirtOuter,
      fence.moundCenter,
      ...scaledField.plate,
    ]
    const xs = [...outlineFlat.map((p) => p[0]), ...points.map((p) => p.hcX)]
    const ys = [...outlineFlat.map((p) => p[1]), ...points.map((p) => p.hcY)]
    const [x0, x1] = extentWithPadding(xs, EXTENT_PAD_X, [35, 215])
    const [y0, y1] = extentWithPadding(ys, EXTENT_PAD_Y, [-28, 430])
    const dataW = x1 - x0
    const dataH = y1 - y0
    const plotW = W - PAD.l - PAD.r
    const plotH = H - PAD.t - PAD.b
    const innerW = Math.max(1, plotW - 2 * PLOT_INSET_PX)
    const innerH = Math.max(1, plotH - 2 * PLOT_INSET_PX)
    // Same ft→px on both axes; also cap width usage so the infield is never edge-to-edge.
    const scale = Math.min(
      innerH / dataH,
      innerW / dataW,
      (MAX_FIELD_WIDTH_FRAC * innerW) / dataW,
    )
    const drawW = dataW * scale
    const drawH = dataH * scale
    const originX = PAD.l + PLOT_INSET_PX + (innerW - drawW) / 2
    const originY = PAD.t + PLOT_INSET_PX + (innerH - drawH) / 2
    const [hx0, hy0] = scaledField.fence.home
    const pxPerFt = Math.abs(originX + (hx0 + 1 - x0) * scale - (originX + (hx0 - x0) * scale))
    return {
      sx: (hx: number) => originX + (hx - x0) * scale,
      sy: (hy: number) => originY + (y1 - hy) * scale,
      pxPerFt,
    }
  }, [points, scaledField])

  const { topHalf: topColor, bottomHalf: bottomColor, other: otherColor } = useMemo(
    () => statcastHalfFillColors(awayTeamId, homeTeamId, surfaceHex),
    [awayTeamId, homeTeamId, surfaceHex],
  )

  const fairPathD = useMemo(() => {
    const { home, lf, lcf, cf, rcf, rf } = scaledField.fence
    const [hx, hy] = home
    return `M ${sx(hx).toFixed(2)} ${sy(hy).toFixed(2)} L ${sx(lf[0]).toFixed(2)} ${sy(lf[1]).toFixed(2)} L ${sx(lcf[0]).toFixed(2)} ${sy(lcf[1]).toFixed(2)} L ${sx(cf[0]).toFixed(2)} ${sy(cf[1]).toFixed(2)} L ${sx(rcf[0]).toFixed(2)} ${sy(rcf[1]).toFixed(2)} L ${sx(rf[0]).toFixed(2)} ${sy(rf[1]).toFixed(2)} Z`
  }, [sx, sy, scaledField])

  const fenceLabels = useMemo(() => {
    const { fence } = scaledField
    const { home, lf, lcf, cf, rcf, rf } = fence
    const nudge = (p: [number, number]): [number, number] => {
      const dx = p[0] - home[0]
      const dy = p[1] - home[1]
      const len = Math.hypot(dx, dy)
      if (len < 1e-6) return p
      const s = 11 / len
      return [p[0] + dx * s, p[1] + dy * s]
    }
    return [
      { key: 'lf', text: `${fieldDims.lf}`, pt: nudge(lf) },
      { key: 'lcf', text: `${Math.round(fence.lcfFt)}`, pt: nudge(lcf) },
      { key: 'cf', text: `${fieldDims.cf}`, pt: nudge(cf) },
      { key: 'rcf', text: `${Math.round(fence.rcfFt)}`, pt: nudge(rcf) },
      { key: 'rf', text: `${fieldDims.rf}`, pt: nudge(rf) },
    ]
  }, [scaledField, fieldDims])

  /** Linear turf gradient: plate → CF (broadcast-style shading, deeper OF). */
  const grassLinear = useMemo(() => {
    const [hx, hy] = scaledField.fence.home
    const [cx, cy] = scaledField.ofControl
    return {
      x1: sx(hx),
      y1: sy(hy),
      x2: sx(cx),
      y2: sy(cy),
    }
  }, [sx, sy, scaledField])

  const dirtPathD = useMemo(
    () => pathFromPoints(sx, sy, scaledField.fence.infieldDirtOuter, true),
    [sx, sy, scaledField.fence.infieldDirtOuter],
  )

  const infieldGrassPathD = useMemo(
    () => pathFromPoints(sx, sy, scaledField.fence.infieldGrass, true),
    [sx, sy, scaledField.fence.infieldGrass],
  )

  const uCfPlan = useMemo((): [number, number] => {
    const { home, cf } = scaledField.fence
    const dx = cf[0] - home[0]
    const dy = cf[1] - home[1]
    const h = Math.hypot(dx, dy)
    if (h < 1e-9) return [0, 1]
    return [dx / h, dy / h]
  }, [scaledField.fence])

  const moundRubberD = useMemo(() => {
    const m = scaledField.fence.moundCenter
    const [ux, uy] = uCfPlan
    const wx = -uy
    const wy = ux
    const half = 3.25
    const a: [number, number] = [m[0] - wx * half, m[1] - wy * half]
    const b: [number, number] = [m[0] + wx * half, m[1] + wy * half]
    return `M ${sx(a[0]).toFixed(2)} ${sy(a[1]).toFixed(2)} L ${sx(b[0]).toFixed(2)} ${sy(b[1]).toFixed(2)}`
  }, [sx, sy, scaledField.fence.moundCenter, uCfPlan])
  const platePathD = useMemo(
    () => pathFromPoints(sx, sy, scaledField.plate, true),
    [sx, sy, scaledField.plate],
  )

  const foulLeftD = useMemo(() => {
    const [hx, hy] = scaledField.fence.home
    const [lx, ly] = scaledField.fence.lf
    return `M ${sx(hx).toFixed(2)} ${sy(hy).toFixed(2)} L ${sx(lx).toFixed(2)} ${sy(ly).toFixed(2)}`
  }, [sx, sy, scaledField.fence])

  const foulRightD = useMemo(() => {
    const [hx, hy] = scaledField.fence.home
    const [rx, ry] = scaledField.fence.rf
    return `M ${sx(hx).toFixed(2)} ${sy(hy).toFixed(2)} L ${sx(rx).toFixed(2)} ${sy(ry).toFixed(2)}`
  }, [sx, sy, scaledField.fence])

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
            Outline uses a 90° fair sector at home, fence corners at published LF / CF / RF from{' '}
            <strong>{venueName}</strong> ({fieldDims.lf} / {fieldDims.cf} / {fieldDims.rf} ft); power
            alleys are estimated. Dots share hc_x / hc_y with this diagram (feet).
          </>
        ) : (
          <>
            Outline uses generic LF / CF / RF distances; venue unknown. Dots use field coordinates
            (feet).
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
          <linearGradient id={`${gid}-chart-bg`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--spray-chart-bg-a)" />
            <stop offset="100%" stopColor="var(--spray-chart-bg-b)" />
          </linearGradient>
          <linearGradient
            id={`${gid}-grass`}
            gradientUnits="userSpaceOnUse"
            x1={grassLinear.x1}
            y1={grassLinear.y1}
            x2={grassLinear.x2}
            y2={grassLinear.y2}
          >
            <stop offset="0%" stopColor="var(--spray-grass-a)" />
            <stop offset="52%" stopColor="var(--spray-grass-mid)" />
            <stop offset="100%" stopColor="var(--spray-grass-b)" />
          </linearGradient>
          <linearGradient id={`${gid}-dirt`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--spray-dirt-a)" />
            <stop offset="100%" stopColor="var(--spray-dirt-b)" />
          </linearGradient>
        </defs>

        <rect width={W} height={H} fill={`url(#${gid}-chart-bg)`} rx={6} />

        <path
          d={fairPathD}
          fill={`url(#${gid}-grass)`}
          stroke="var(--spray-fence-line)"
          strokeWidth={1.1}
          strokeLinejoin="miter"
          strokeMiterlimit={2.2}
        />
        <path
          d={dirtPathD}
          fill={`url(#${gid}-dirt)`}
          stroke="var(--spray-dirt-line)"
          strokeWidth={0.85}
          strokeLinejoin="miter"
          strokeMiterlimit={2.2}
          opacity={0.94}
        />
        <path
          d={infieldGrassPathD}
          fill={`url(#${gid}-grass)`}
          stroke="none"
          opacity={0.98}
        />
        <circle
          cx={sx(scaledField.fence.moundCenter[0])}
          cy={sy(scaledField.fence.moundCenter[1])}
          r={6.25 * pxPerFt}
          fill="var(--spray-dirt-a)"
          stroke="var(--spray-dirt-line)"
          strokeWidth={0.9}
          opacity={0.96}
        />
        <path
          d={moundRubberD}
          fill="none"
          stroke="var(--spray-plate-line)"
          strokeWidth={1.1}
          strokeLinecap="round"
          opacity={0.9}
        />

        <path
          d={foulLeftD}
          fill="none"
          stroke="var(--spray-foul-line)"
          strokeWidth={1.35}
          strokeLinecap="round"
          opacity={0.95}
        />
        <path
          d={foulRightD}
          fill="none"
          stroke="var(--spray-foul-line)"
          strokeWidth={1.35}
          strokeLinecap="round"
          opacity={0.95}
        />

        <path
          d={platePathD}
          fill="var(--spray-plate)"
          stroke="var(--spray-plate-line)"
          strokeWidth={0.9}
          strokeLinejoin="round"
        />

        {fenceLabels.map(({ key, text, pt }) => (
          <text
            key={key}
            className="game-statcast-spray__fence-ft"
            x={sx(pt[0])}
            y={sy(pt[1])}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--spray-fence-label)"
            fontSize={8.5}
            fontWeight={500}
            style={{ pointerEvents: 'none' }}
            aria-hidden
          >
            {text}
          </text>
        ))}

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
