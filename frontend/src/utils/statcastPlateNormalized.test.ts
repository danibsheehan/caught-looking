import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SZ_BOT_FT,
  DEFAULT_SZ_TOP_FT,
  PLATE_HALF_FT,
  normalizedPlateLocation,
  projNormToSvg,
  resolveStrikeZoneFeet,
} from './statcastPlateNormalized'
import type { StatcastPitch } from '../types/api'

const pitch = (overrides: Partial<StatcastPitch>): StatcastPitch => ({
  plateX: 0,
  plateZ: 2.5,
  pitcher: 1,
  ...overrides,
})

describe('resolveStrikeZoneFeet', () => {
  it('uses szTop/szBot when valid', () => {
    expect(
      resolveStrikeZoneFeet(pitch({ szTop: 3.4, szBot: 1.6 })),
    ).toEqual({ bot: 1.6, top: 3.4 })
  })

  it('falls back when sz missing or invalid', () => {
    expect(resolveStrikeZoneFeet(pitch({}))).toEqual({
      bot: DEFAULT_SZ_BOT_FT,
      top: DEFAULT_SZ_TOP_FT,
    })
    expect(resolveStrikeZoneFeet(pitch({ szTop: 1.5, szBot: 3.5 }))).toEqual({
      bot: DEFAULT_SZ_BOT_FT,
      top: DEFAULT_SZ_TOP_FT,
    })
  })
})

describe('normalizedPlateLocation', () => {
  it('maps center plate_x to xN 0 and mid-zone plate_z to zN ~0.5 with defaults', () => {
    const mid = (DEFAULT_SZ_BOT_FT + DEFAULT_SZ_TOP_FT) / 2
    const { xN, zN } = normalizedPlateLocation(
      pitch({ plateX: 0, plateZ: mid, szTop: undefined, szBot: undefined }),
    )
    expect(xN).toBe(0)
    expect(zN).toBeCloseTo(0.5, 5)
  })

  it('scales horizontal by half-plate width', () => {
    const { xN } = normalizedPlateLocation(
      pitch({ plateX: PLATE_HALF_FT, plateZ: 2.5 }),
    )
    expect(xN).toBeCloseTo(1, 5)
  })
})

describe('projNormToSvg', () => {
  it('maps corners into 0–100', () => {
    const lo = projNormToSvg(-1.35, -0.22)
    const hi = projNormToSvg(1.35, 1.22)
    expect(lo.x).toBeCloseTo(0, 5)
    expect(hi.x).toBeCloseTo(100, 5)
    expect(lo.y).toBeCloseTo(100, 5)
    expect(hi.y).toBeCloseTo(0, 5)
  })
})
