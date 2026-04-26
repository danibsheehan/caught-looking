/** Trailing mean of `values[0..i]` capped at the last `window` entries (inclusive). */
export function rollingTrailingMean(values: number[], window: number): number[] {
  if (values.length === 0) return []
  const w = Math.max(1, Math.floor(window))
  const out: number[] = []
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - w + 1)
    let sum = 0
    const n = i - start + 1
    for (let j = start; j <= i; j++) sum += values[j]
    out.push(sum / n)
  }
  return out
}
