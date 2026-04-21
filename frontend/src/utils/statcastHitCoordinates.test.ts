import { describe, expect, it } from 'vitest'
import {
  FIELD_PLATE_X,
  FIELD_PLATE_Y,
  statcastHcToFieldFeet,
  STATCAST_HC_X_PLATE,
  STATCAST_HC_Y_PLATE,
} from './statcastHitCoordinates'

describe('statcastHcToFieldFeet', () => {
  it('maps Savant plate center to diagram plate (SPRAY_HOME)', () => {
    const p = statcastHcToFieldFeet(STATCAST_HC_X_PLATE, STATCAST_HC_Y_PLATE)
    expect(p.x).toBeCloseTo(FIELD_PLATE_X, 5)
    expect(p.y).toBeCloseTo(FIELD_PLATE_Y, 5)
  })

  it('places a deep HR-style grid point in the outfield, not on the infield', () => {
    // Example: small hc_y (toward OF in Savant space) → large depth in feet
    const p = statcastHcToFieldFeet(183, 44)
    expect(p.y).toBeGreaterThan(350)
    expect(p.x).toBeGreaterThan(FIELD_PLATE_X)
  })
})
