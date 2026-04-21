import { describe, expect, it } from 'vitest'
import { neonThemeSeriesFills } from './neonChartPalette'

describe('neonThemeSeriesFills', () => {
  it('returns one hex per count, cycling seeds', () => {
    const a = neonThemeSeriesFills(3, '#070b10')
    expect(a).toHaveLength(3)
    expect(a[0]).toMatch(/^#/)
    expect(a[1]).toMatch(/^#/)
    expect(a[2]).toMatch(/^#/)
    expect(a[0]).not.toBe(a[1])
  })

  it('repeats predictably when count exceeds seed list length', () => {
    const surface = '#070b10'
    const long = neonThemeSeriesFills(8, surface)
    const short = neonThemeSeriesFills(2, surface)
    expect(long[0]).toBe(short[0])
    expect(long[1]).toBe(short[1])
    expect(long[6]).toBe(short[0])
    expect(long[7]).toBe(short[1])
  })
})
