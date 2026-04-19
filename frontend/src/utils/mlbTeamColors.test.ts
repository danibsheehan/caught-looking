import { describe, expect, it } from 'vitest'
import { adjustChartColorForSurface } from './chartColorContrast'
import {
  CHART_NEUTRAL_FALLBACK,
  MLB_TEAM_PRIMARY_HEX,
  distinctChartColorsForTeamIds,
  mlbTeamPrimaryHex,
  resolveGameScoreBarFills,
  rgbDistance,
  teamSplitChartColors,
} from './mlbTeamColors'

describe('rgbDistance', () => {
  it('returns Euclidean distance in RGB space', () => {
    expect(rgbDistance('#000000', '#ffffff')).toBeCloseTo(Math.sqrt(255 ** 2 * 3))
  })

  it('returns 255 when either hex is invalid', () => {
    expect(rgbDistance('xx', '#ffffff')).toBe(255)
    expect(rgbDistance('#ffffff', 'bad')).toBe(255)
  })
})

describe('distinctChartColorsForTeamIds', () => {
  it('returns empty array for empty input', () => {
    expect(distinctChartColorsForTeamIds([], '#ffffff')).toEqual([])
  })

  it('assigns adjusted colors for known teams', () => {
    const colors = distinctChartColorsForTeamIds([108, 109], '#ffffff')
    expect(colors).toHaveLength(2)
    expect(colors[0]).toMatch(/^#/)
    expect(colors[1]).toMatch(/^#/)
    expect(colors[0]).not.toBe(colors[1])
  })

  it('uses neutral fallback for invalid team id', () => {
    const colors = distinctChartColorsForTeamIds([0], '#ffffff')
    expect(colors).toHaveLength(1)
    expect(colors[0]).toMatch(/^#/)
  })
})

describe('resolveGameScoreBarFills', () => {
  it('uses both primaries when they are far apart in RGB', () => {
    const awayId = 112
    const homeId = 120
    const pAway = MLB_TEAM_PRIMARY_HEX[awayId]
    const pHome = MLB_TEAM_PRIMARY_HEX[homeId]
    expect(rgbDistance(pAway, pHome)).toBeGreaterThanOrEqual(72)

    const { awayFill, homeFill } = resolveGameScoreBarFills(
      awayId,
      homeId,
      '#111',
      '#222',
    )
    expect(awayFill).toBe(pAway)
    expect(homeFill).toBe(pHome)
  })

  it('uses fallbacks when team ids are missing', () => {
    const { awayFill, homeFill } = resolveGameScoreBarFills(null, undefined, '#aaa', '#bbb')
    expect(awayFill).toBe('#aaa')
    expect(homeFill).toBe('#bbb')
  })

  it('prefers a more separated pair when primaries clash', () => {
    const { awayFill, homeFill } = resolveGameScoreBarFills(108, 108, '#111', '#222')
    expect(awayFill).toBeDefined()
    expect(homeFill).toBeDefined()
    expect(rgbDistance(awayFill, homeFill)).toBeGreaterThan(0)
  })
})

describe('mlbTeamPrimaryHex', () => {
  it('returns mapped primary for known id', () => {
    expect(mlbTeamPrimaryHex(108, '#fallback')).toBe('#BA0021')
  })

  it('returns fallback for unknown or invalid id', () => {
    expect(mlbTeamPrimaryHex(999999, '#z')).toBe('#z')
    expect(mlbTeamPrimaryHex(null, '#z')).toBe('#z')
    expect(mlbTeamPrimaryHex(-1, '#z')).toBe('#z')
  })
})

describe('teamSplitChartColors', () => {
  it('returns offense and defense hex strings for a known team', () => {
    const { offense, defense } = teamSplitChartColors(108, '#ffffff')
    expect(offense).toMatch(/^#/)
    expect(defense).toMatch(/^#/)
    expect(offense).not.toBe(defense)
  })

  it('uses neutrals when team id is invalid', () => {
    const { offense, defense } = teamSplitChartColors(null, '#ffffff')
    expect(offense).toBe(
      adjustChartColorForSurface(CHART_NEUTRAL_FALLBACK, '#ffffff'),
    )
    expect(defense).toMatch(/^#/)
    expect(defense).not.toBe(offense)
  })
})
