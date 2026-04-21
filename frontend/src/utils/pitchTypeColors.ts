/** Distinct colors for pitch-type series (works on light and dark chart backgrounds). */
const PITCH_TYPE_PALETTE = [
  '#4e79a7',
  '#f28e2b',
  '#e15759',
  '#76b7b2',
  '#59a14f',
  '#edc949',
  '#af7aa1',
  '#ff9da7',
  '#9c755f',
  '#499894',
  '#bab0ab',
]

/**
 * Stable color for a pitch label (e.g. "4-Seam Fastball") so the same type matches across charts.
 */
export function pitchTypeColor(pitchName: string): string {
  const key = pitchName.trim() || 'Unknown'
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const idx = (h >>> 0) % PITCH_TYPE_PALETTE.length
  return PITCH_TYPE_PALETTE[idx]
}
