import {
  STATCAST_SCATTER_DOT_R,
  statcastSprayDiamondPath,
} from '../../utils/statcastMarkerGeometry'

type ScatterShapeProps = {
  cx?: number
  cy?: number
  fill?: string
  stroke?: string
  strokeWidth?: number
}

/** Recharts `<Scatter shape={...} />` — away (top) uses circles, home (bottom) diamonds. */
export function StatcastScatterShapeDiamond(props: ScatterShapeProps) {
  const { cx = 0, cy = 0, fill } = props
  const r = STATCAST_SCATTER_DOT_R
  const sw = props.strokeWidth ?? 1
  return (
    <path
      d={statcastSprayDiamondPath(cx, cy, r)}
      fill={fill}
      stroke={props.stroke ?? 'var(--border)'}
      strokeWidth={sw}
    />
  )
}

export function StatcastScatterShapeCircle(props: ScatterShapeProps) {
  const { cx = 0, cy = 0, fill } = props
  const r = STATCAST_SCATTER_DOT_R
  const sw = props.strokeWidth ?? 1
  return <circle cx={cx} cy={cy} r={r} fill={fill} stroke={props.stroke ?? 'var(--border)'} strokeWidth={sw} />
}
