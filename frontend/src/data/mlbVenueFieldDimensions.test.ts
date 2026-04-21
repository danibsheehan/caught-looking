import { describe, expect, it } from 'vitest'
import { getFieldDimensionsForVenue, VENUE_FIELD_DIMENSIONS_FT } from './mlbVenueFieldDimensions'
import {
  buildHomePlateOutline,
  buildSprayFenceGeometry,
  scaleSprayOutlinePoint,
  SPRAY_HOME,
  SPRAY_OF_CONTROL,
} from './parkSprayOutline'

describe('mlbVenueFieldDimensions', () => {
  it('returns Coors-like deeper CF for venue 19', () => {
    const d = getFieldDimensionsForVenue(19)
    expect(d.cf).toBeGreaterThan(410)
    expect(VENUE_FIELD_DIMENSIONS_FT[19]?.cf).toBe(d.cf)
  })

  it('falls back for unknown venue id', () => {
    const d = getFieldDimensionsForVenue(999_999)
    expect(d).toEqual({ lf: 330, rf: 330, cf: 400 })
  })
})

describe('parkSprayOutline', () => {
  it('deepens outfield control when CF fence is longer', () => {
    const shallow = scaleSprayOutlinePoint(SPRAY_OF_CONTROL, { lf: 330, rf: 330, cf: 380 })
    const deep = scaleSprayOutlinePoint(SPRAY_OF_CONTROL, { lf: 330, rf: 330, cf: 420 })
    expect(deep[1]).toBeGreaterThan(shallow[1])
  })

  it('buildSprayFenceGeometry uses perpendicular foul rays (90° fair opening)', () => {
    const g = buildSprayFenceGeometry({ lf: 330, cf: 410, rf: 330 })
    const vL = [g.lf[0] - g.home[0], g.lf[1] - g.home[1]] as [number, number]
    const vR = [g.rf[0] - g.home[0], g.rf[1] - g.home[1]] as [number, number]
    const dot =
      (vL[0] * vR[0] + vL[1] * vR[1]) / (Math.hypot(vL[0], vL[1]) * Math.hypot(vR[0], vR[1]))
    expect(Math.abs(dot)).toBeLessThan(1e-5)
    expect(g.lcfFt).toBeGreaterThan(330)
    expect(g.lcfFt).toBeLessThan(410)
    expect(Math.hypot(g.lcf[0] - g.home[0], g.lcf[1] - g.home[1])).toBeGreaterThan(
      Math.hypot(g.lf[0] - g.home[0], g.lf[1] - g.home[1]),
    )
    expect(g.infieldGrass.length).toBe(4)
    expect(g.infieldDirtOuter.length).toBe(4)
    expect(g.plate.length).toBe(6)
  })

  it('base paths use 1B/3B rays perpendicular at home (90 ft square diamond)', () => {
    const g = buildSprayFenceGeometry({ lf: 330, cf: 400, rf: 330 })
    const h = g.home
    const to1: [number, number] = [g.first[0] - h[0], g.first[1] - h[1]]
    const to3: [number, number] = [g.third[0] - h[0], g.third[1] - h[1]]
    const dot = to1[0] * to3[0] + to1[1] * to3[1]
    const len = Math.hypot(to1[0], to1[1]) * Math.hypot(to3[0], to3[1])
    expect(dot / len).toBeCloseTo(0, 5)
    expect(Math.hypot(to1[0], to1[1])).toBeCloseTo(90, 5)
    expect(Math.hypot(to3[0], to3[1])).toBeCloseTo(90, 5)
  })

  it('buildHomePlateOutline returns a closed pentagon in the CF frame', () => {
    const uCf: [number, number] = [0, 1]
    const pts = buildHomePlateOutline(SPRAY_HOME, uCf)
    expect(pts.length).toBe(6)
    expect(pts[0][0]).toBe(pts[5][0])
    expect(pts[0][1]).toBe(pts[5][1])
  })
})
