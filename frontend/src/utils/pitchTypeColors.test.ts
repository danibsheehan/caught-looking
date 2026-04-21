import { describe, expect, it } from 'vitest'
import { pitchTypeColor } from './pitchTypeColors'

describe('pitchTypeColor', () => {
  it('returns the same color for the same label', () => {
    expect(pitchTypeColor('Slider')).toBe(pitchTypeColor('Slider'))
  })

  it('treats blank as Unknown', () => {
    expect(pitchTypeColor('')).toBe(pitchTypeColor('Unknown'))
  })
})
