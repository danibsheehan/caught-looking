/** Spray chart dot radius (SVG user units); matches former circle `r`. */
export const STATCAST_SPRAY_DOT_R = 5.25

/** Recharts scatter glyph size — modest radius + fill opacity keeps dense clusters readable. */
export const STATCAST_SCATTER_DOT_R = 3.5

export const STATCAST_SCATTER_FILL_OPACITY = 0.78

export function statcastSprayDiamondPath(cx: number, cy: number, r: number): string {
  return `M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`
}
