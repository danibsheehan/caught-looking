import { describe, expect, it } from 'vitest'
import { contrastRatio } from './chartColorContrast'
import { MLB_TEAM_PRIMARY_HEX, rgbDistance } from './mlbTeamColors'
import { statcastHalfFillColors } from './statcastHalfColors'

describe('statcastHalfFillColors', () => {
  it('returns clearly different top vs bottom on white surface', () => {
    const { topHalf, bottomHalf } = statcastHalfFillColors(119, 121, '#ffffff')
    expect(contrastRatio(topHalf, bottomHalf)).toBeGreaterThan(1.15)
    expect(topHalf).not.toBe(bottomHalf)
  })

  it('uses semantic pair when ids missing (distinct hex)', () => {
    const { topHalf, bottomHalf } = statcastHalfFillColors(undefined, undefined, '#ffffff')
    expect(topHalf).not.toBe(bottomHalf)
    expect(topHalf.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/)
    expect(bottomHalf.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('stays distinct on dark chart surfaces', () => {
    const { topHalf, bottomHalf } = statcastHalfFillColors(undefined, undefined, '#16171d')
    expect(topHalf).not.toBe(bottomHalf)
    expect(contrastRatio(topHalf, bottomHalf)).toBeGreaterThan(1.1)
  })

  it('uses team primaries on dark surfaces, not generic semantic seeds', () => {
    const dodgersPrimary = MLB_TEAM_PRIMARY_HEX[119]
    const { topHalf } = statcastHalfFillColors(119, 121, '#16171d')
    const semanticAwayDark = '#22d3ee'
    expect(rgbDistance(topHalf, dodgersPrimary)).toBeLessThan(
      rgbDistance(topHalf, semanticAwayDark),
    )
  })
})
