import { useMemo } from 'react'
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { useChartSurfaceHex } from '../../hooks/useChartSurfaceHex'
import { adjustChartColorForSurface } from '../../utils/chartColorContrast'
import { CHART_NEUTRAL_FALLBACK, mlbTeamPrimaryHex } from '../../utils/mlbTeamColors'

export type DivisionScatterPoint = {
  teamId: number
  rs: number
  ra: number
  label: string
}

type DivisionRunsScatterProps = {
  points: DivisionScatterPoint[]
  focusTeamId?: number
}

export default function DivisionRunsScatter({
  points,
  focusTeamId,
}: DivisionRunsScatterProps) {
  const surfaceHex = useChartSurfaceHex()

  const { domain, plot } = useMemo(() => {
    if (!points.length) {
      return { domain: [0, 1] as [number, number], plot: [] as typeof points }
    }
    const vals = points.flatMap((p) => [p.rs, p.ra])
    const lo = Math.min(...vals)
    const hi = Math.max(...vals)
    const span = hi - lo || 1
    const pad = Math.max(12, span * 0.06)
    const d0 = Math.floor(lo - pad)
    const d1 = Math.ceil(hi + pad)
    return { domain: [d0, d1] as [number, number], plot: points }
  }, [points])

  if (!plot.length) {
    return (
      <p className="muted">
        Run totals for this division are not available yet (need runs scored and
        allowed in standings).
      </p>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart margin={{ top: 10, right: 12, left: 4, bottom: 28 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          type="number"
          dataKey="ra"
          name="Runs allowed"
          domain={domain}
          tick={{ fill: 'var(--text)', fontSize: 11 }}
          label={{
            value: 'Runs allowed (season)',
            position: 'insideBottom',
            offset: -4,
            fill: 'var(--text)',
            fontSize: 11,
          }}
        />
        <YAxis
          type="number"
          dataKey="rs"
          name="Runs scored"
          domain={domain}
          tick={{ fill: 'var(--text)', fontSize: 11 }}
          width={48}
          label={{
            value: 'Runs scored (season)',
            angle: -90,
            position: 'insideLeft',
            fill: 'var(--text)',
            fontSize: 11,
          }}
        />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          content={DivisionRunsTooltip}
        />
        <ReferenceLine
          segment={[
            { x: domain[0], y: domain[0] },
            { x: domain[1], y: domain[1] },
          ]}
          stroke="var(--border)"
          strokeDasharray="4 4"
        />
        <Scatter data={plot} shape={(props) => scatterDot(props, focusTeamId, surfaceHex)} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

function DivisionRunsTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as DivisionScatterPoint | undefined
  if (!row) return null
  return (
    <div
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
      <div style={{ fontWeight: 600 }}>{row.label}</div>
      <div style={{ marginTop: '0.2rem', color: 'var(--text)' }}>
        {row.rs} scored · {row.ra} allowed
      </div>
    </div>
  )
}

function scatterDot(
  props: {
    cx?: number
    cy?: number
    payload?: DivisionScatterPoint
  },
  focusTeamId: number | undefined,
  surfaceHex: string,
) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null || !payload) return null
  const base = mlbTeamPrimaryHex(payload.teamId, CHART_NEUTRAL_FALLBACK)
  const fill = adjustChartColorForSurface(base, surfaceHex)
  const focused = focusTeamId != null && payload.teamId === focusTeamId
  const r = focused ? 9 : 5.5
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={fill}
      stroke={focused ? 'var(--text-h)' : 'color-mix(in srgb, var(--bg) 35%, var(--border))'}
      strokeWidth={focused ? 2.25 : 1}
    />
  )
}
