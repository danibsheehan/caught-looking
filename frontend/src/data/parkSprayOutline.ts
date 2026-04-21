import type { FieldDimensionsFt } from './mlbVenueFieldDimensions'
import { DEFAULT_FIELD_DIMS } from './mlbVenueFieldDimensions'

/**
 * Reference fair-territory template in field coordinates hc_x / hc_y (feet), matched to ~DEFAULT_FIELD_DIMS.
 */
export const SPRAY_HOME: [number, number] = [125, 4]
export const SPRAY_LF: [number, number] = [14, 72]
export const SPRAY_RF: [number, number] = [236, 72]
export const SPRAY_OF_CONTROL: [number, number] = [125, 402]

export const SPRAY_INFIELD: [number, number][] = [
  [125, 14],
  [160, 58],
  [125, 96],
  [90, 58],
  [125, 14],
]

export const SPRAY_PLATE: [number, number][] = [
  [125, -2],
  [118, 4],
  [120, 9],
  [130, 9],
  [132, 4],
  [125, -2],
]

const REF = DEFAULT_FIELD_DIMS
const HOME = SPRAY_HOME

/**
 * Warps template coordinates so deeper / wider parks expand the decorative outline.
 * Hit scatter points use raw tracking coords; only the field art is scaled.
 */
export function scaleSprayOutlinePoint(
  xy: [number, number],
  dims: FieldDimensionsFt,
): [number, number] {
  const [x, y] = xy
  const depthScale = dims.cf / REF.cf
  const widthScale = (dims.lf + dims.rf) / 2 / ((REF.lf + REF.rf) / 2)
  const t = Math.min(1, Math.max(0, (y - HOME[1]) / 140))
  const w = 1 + (widthScale - 1) * t * 0.92
  const d = 1 + (depthScale - 1) * t * 0.92
  return [HOME[0] + (x - HOME[0]) * w, HOME[1] + (y - HOME[1]) * d]
}

export function scaleSprayOutlinePoints(
  pts: [number, number][],
  dims: FieldDimensionsFt,
): [number, number][] {
  return pts.map((p) => scaleSprayOutlinePoint(p, dims))
}
