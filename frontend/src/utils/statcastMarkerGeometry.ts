/** Spray chart dot radius (SVG user units); matches former circle `r`. */
export const STATCAST_SPRAY_DOT_R = 5.25

/** Recharts scatter glyph size (matches prior default point ~). */
export const STATCAST_SCATTER_DOT_R = 4.5

export function statcastSprayDiamondPath(cx: number, cy: number, r: number): string {
  return `M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`
}
