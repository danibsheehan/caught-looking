import { describe, expect, it } from 'vitest'
import type { StatcastPitch } from '../types/api.compat'
import {
  PITCH_COLORS,
  opacityFromUsageShare,
  pitchHexForCode,
  pitchMarkerFillStyle,
  pitchShareByCode,
  pitchTypeColor,
  resolvePitchCode,
} from './pitchTypeColors'

const base: StatcastPitch = { plateX: 0, plateZ: 0, pitcher: 0 }

describe('pitchTypeColor', () => {
  it('returns the same color for the same label', () => {
    expect(pitchTypeColor('Slider')).toBe(pitchTypeColor('Slider'))
  })

  it('treats blank as Unknown', () => {
    expect(pitchTypeColor('')).toBe(pitchTypeColor('Unknown'))
  })
})

describe('resolvePitchCode', () => {
  it('prefers API pitchType when present', () => {
    expect(
      resolvePitchCode({
        ...base,
        pitchName: '4-Seam Fastball',
        pitchType: 'SI',
      }),
    ).toBe('SI')
  })

  it('maps common pitch names to codes', () => {
    expect(resolvePitchCode({ ...base, pitchName: 'Slider' })).toBe('SL')
    expect(pitchHexForCode('SL')).toBe(PITCH_COLORS.SL)
  })
})

describe('opacityFromUsageShare', () => {
  it('maps 0–1 usage to 0.55–1 opacity', () => {
    expect(opacityFromUsageShare(0)).toBeCloseTo(0.55, 5)
    expect(opacityFromUsageShare(1)).toBeCloseTo(1, 5)
  })
})

describe('pitchMarkerFillStyle', () => {
  it('boosts opacity when isolated so rare pitch types stay legible', () => {
    const p: StatcastPitch = { ...base, pitchName: 'Eephus', pitchType: 'EP' }
    const share = new Map([['EP', 0.03]])
    const normal = pitchMarkerFillStyle(p, share)
    const iso = pitchMarkerFillStyle(p, share, { isolated: true })
    expect(iso.fillOpacity).toBeGreaterThan(normal.fillOpacity)
  })
})

describe('pitchShareByCode', () => {
  it('sums to 1 across codes', () => {
    const pitches: StatcastPitch[] = [
      { ...base, pitchName: '4-Seam Fastball' },
      { ...base, pitchName: '4-Seam Fastball' },
      { ...base, pitchName: 'Slider' },
    ]
    const m = pitchShareByCode(pitches)
    let sum = 0
    for (const v of m.values()) {
      sum += v
    }
    expect(sum).toBeCloseTo(1, 5)
  })
})
