import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SZ_BOT_FT,
  DEFAULT_SZ_TOP_FT,
  PLATE_HALF_FT,
  normalizedPlateLocation,
  projNormToSvg,
  projNormToSvgCatcherPerspective,
  projNormToSvgStrikeSquare,
  resolveStrikeZoneFeet,
} from './statcastPlateNormalized'
import type { StatcastPitch } from '../types/api.compat'

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

describe('projNormToSvgCatcherPerspective', () => {
  it('matches flat projection at the bottom of the plot (near catcher)', () => {
    const a = projNormToSvg(-0.5, -0.22)
    const b = projNormToSvgCatcherPerspective(-0.5, -0.22)
    expect(b.x).toBeCloseTo(a.x, 5)
    expect(b.y).toBeCloseTo(a.y, 5)
  })

  it('narrows horizontal span toward the pitcher (top of plot)', () => {
    const flat = projNormToSvg(1.35, 1.22)
    const persp = projNormToSvgCatcherPerspective(1.35, 1.22)
    expect(persp.x).toBeLessThan(flat.x)
    expect(persp.y).toBeCloseTo(flat.y, 5)
  })
})

function dist(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

describe('projNormToSvgStrikeSquare', () => {
  it('maps the official strike zone polygon to equal sides (square)', () => {
    const bl = projNormToSvgStrikeSquare(-1, 0)
    const br = projNormToSvgStrikeSquare(1, 0)
    const tr = projNormToSvgStrikeSquare(1, 1)
    const tl = projNormToSvgStrikeSquare(-1, 1)
    const bottom = dist(bl, br)
    const right = dist(br, tr)
    const top = dist(tr, tl)
    const left = dist(tl, bl)
    expect(bottom).toBeCloseTo(right, 5)
    expect(right).toBeCloseTo(top, 5)
    expect(top).toBeCloseTo(left, 5)
  })

  it('keeps vertical grid lines vertical (no keystone)', () => {
    const bottom = projNormToSvgStrikeSquare(0.5, -0.22)
    const top = projNormToSvgStrikeSquare(0.5, 1.22)
    expect(bottom.x).toBeCloseTo(top.x, 5)
  })
})
