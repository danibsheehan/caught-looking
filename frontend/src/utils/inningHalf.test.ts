import { describe, expect, it } from 'vitest'
import { inningHalfBucket } from './inningHalf'

describe('inningHalfBucket', () => {
  it('maps Top and Bot inning labels', () => {
    expect(inningHalfBucket('Top')).toBe('top')
    expect(inningHalfBucket('Bot')).toBe('bottom')
  })

  it('maps Bottom spelling', () => {
    expect(inningHalfBucket('Bottom')).toBe('bottom')
  })

  it('returns other for empty or unknown', () => {
    expect(inningHalfBucket(undefined)).toBe('other')
    expect(inningHalfBucket('')).toBe('other')
    expect(inningHalfBucket('mid')).toBe('other')
  })
})
