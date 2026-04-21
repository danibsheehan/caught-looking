import { describe, expect, it } from 'vitest'
import { statcastHalfFillColors } from './statcastHalfColors'

describe('statcastHalfFillColors', () => {
  it('returns two different hex fills on a light chart surface', () => {
    const { topHalf, bottomHalf, other } = statcastHalfFillColors(119, 121, '#ffffff')
    expect(topHalf).not.toBe(bottomHalf)
    expect(topHalf).not.toBe(other)
    expect(bottomHalf).not.toBe(other)
    expect(topHalf.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/)
    expect(bottomHalf.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('returns distinct fills on dark chart surfaces', () => {
    const { topHalf, bottomHalf } = statcastHalfFillColors(undefined, undefined, '#16171d')
    expect(topHalf).not.toBe(bottomHalf)
  })

  it('does not depend on team ids (same pair for any ids)', () => {
    const a = statcastHalfFillColors(143, 144, '#ffffff')
    const b = statcastHalfFillColors(119, 121, '#ffffff')
    expect(a.topHalf).toBe(b.topHalf)
    expect(a.bottomHalf).toBe(b.bottomHalf)
  })
})
