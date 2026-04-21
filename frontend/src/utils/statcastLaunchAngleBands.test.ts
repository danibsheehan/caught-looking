import { describe, expect, it } from 'vitest'
import { launchAngleBandSlices } from './statcastLaunchAngleBands'

describe('launchAngleBandSlices', () => {
  it('returns three slices when domain spans all buckets', () => {
    expect(launchAngleBandSlices([-20, 60])).toEqual([
      { key: 'grounder', x1: -20, x2: 10 },
      { key: 'line_drive', x1: 10, x2: 25 },
      { key: 'fly_ball', x1: 25, x2: 60 },
    ])
  })

  it('omits grounder slice when domain starts at line-drive range', () => {
    expect(launchAngleBandSlices([12, 40])).toEqual([
      { key: 'line_drive', x1: 12, x2: 25 },
      { key: 'fly_ball', x1: 25, x2: 40 },
    ])
  })

  it('returns only fly band when domain is high launch angle', () => {
    expect(launchAngleBandSlices([30, 55])).toEqual([{ key: 'fly_ball', x1: 30, x2: 55 }])
  })

  it('returns only grounder slice when domain is low launch angle', () => {
    expect(launchAngleBandSlices([-15, 5])).toEqual([{ key: 'grounder', x1: -15, x2: 5 }])
  })
})
