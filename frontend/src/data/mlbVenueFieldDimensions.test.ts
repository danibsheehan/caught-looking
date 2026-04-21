import { describe, expect, it } from 'vitest'
import { getFieldDimensionsForVenue, VENUE_FIELD_DIMENSIONS_FT } from './mlbVenueFieldDimensions'
import { scaleSprayOutlinePoint, SPRAY_OF_CONTROL } from './parkSprayOutline'

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
})
