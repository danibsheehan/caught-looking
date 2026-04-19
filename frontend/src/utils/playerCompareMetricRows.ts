import type { PlayersRadarResponse } from '../types/api'

export type CompareAxis = {
  key: string
  label: string
  higherIsBetter: boolean
}

/** Same spokes as the radar chart — keep these in sync when changing either viz. */
export const HITTING_COMPARE_AXES: CompareAxis[] = [
  { key: 'avg', label: 'AVG', higherIsBetter: true },
  { key: 'obp', label: 'OBP', higherIsBetter: true },
  { key: 'slg', label: 'SLG', higherIsBetter: true },
  { key: 'ops', label: 'OPS', higherIsBetter: true },
  { key: 'hr', label: 'HR', higherIsBetter: true },
  { key: 'rbi', label: 'RBI', higherIsBetter: true },
]

export const PITCHING_COMPARE_AXES: CompareAxis[] = [
  { key: 'era', label: 'ERA', higherIsBetter: false },
  { key: 'whip', label: 'WHIP', higherIsBetter: false },
  { key: 'k9', label: 'K/9', higherIsBetter: true },
  { key: 'bb9', label: 'BB/9', higherIsBetter: false },
]

export function pairScores(
  v1: number,
  v2: number,
  higherIsBetter: boolean,
): [number, number] {
  const a = Number.isFinite(v1) ? v1 : 0
  const b = Number.isFinite(v2) ? v2 : 0
  if (higherIsBetter) {
    const m = Math.max(a, b, 1e-6)
    return [(a / m) * 100, (b / m) * 100]
  }
  const m = Math.max(a, b, 1e-6)
  return [((m - a) / m) * 100, ((m - b) / m) * 100]
}

export type CompareMetricRow = {
  metric: string
  key: string
  higherIsBetter: boolean
  a: number
  b: number
  v1: number
  v2: number
}

export function buildCompareMetricRows(
  payload: PlayersRadarResponse | null,
  group: 'hitting' | 'pitching',
): CompareMetricRow[] {
  if (!payload?.players || payload.players.length < 2) return []
  const axes = group === 'pitching' ? PITCHING_COMPARE_AXES : HITTING_COMPARE_AXES
  const [p1, p2] = payload.players
  const s1 = p1.stats ?? {}
  const s2 = p2.stats ?? {}
  return axes.map((ax) => {
    const v1 = s1[ax.key] ?? 0
    const v2 = s2[ax.key] ?? 0
    const [a, b] = pairScores(v1, v2, ax.higherIsBetter)
    return {
      metric: ax.label,
      key: ax.key,
      higherIsBetter: ax.higherIsBetter,
      a,
      b,
      v1,
      v2,
    }
  })
}
