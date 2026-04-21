/**
 * Launch-angle ranges (degrees) for very light chart background bands.
 * Aligns with common Statcast-style grounder / line drive / fly ball splits.
 */
export const LA_BAND_GROUND_MAX = 10
export const LA_BAND_LINE_MAX = 25

export type LaunchAngleBandKey = 'grounder' | 'line_drive' | 'fly_ball'

export type LaunchAngleBandSlice = {
  key: LaunchAngleBandKey
  /** Inclusive-ish clip to plotting domain [xMin, xMax] (Recharts ReferenceArea). */
  x1: number
  x2: number
}

/**
 * Returns up to three horizontal slices (by launch angle) clipped to the chart’s x-domain.
 * Empty ranges are omitted.
 */
export function launchAngleBandSlices(xDomain: readonly [number, number]): LaunchAngleBandSlice[] {
  const [xMin, xMax] = xDomain
  const out: LaunchAngleBandSlice[] = []

  const g1 = xMin
  const g2 = Math.min(LA_BAND_GROUND_MAX, xMax)
  if (g1 < g2) {
    out.push({ key: 'grounder', x1: g1, x2: g2 })
  }

  const ld1 = Math.max(xMin, LA_BAND_GROUND_MAX)
  const ld2 = Math.min(LA_BAND_LINE_MAX, xMax)
  if (ld1 < ld2) {
    out.push({ key: 'line_drive', x1: ld1, x2: ld2 })
  }

  const fb1 = Math.max(xMin, LA_BAND_LINE_MAX)
  const fb2 = xMax
  if (fb1 < fb2) {
    out.push({ key: 'fly_ball', x1: fb1, x2: fb2 })
  }

  return out
}
