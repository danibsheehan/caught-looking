import { describe, expect, it } from 'vitest'
import type { PlayersRadarResponse } from '../types/api'
import {
  buildCompareMetricRows,
  HITTING_COMPARE_AXES,
  pairScores,
  PITCHING_COMPARE_AXES,
} from './playerCompareMetricRows'

function radarPayload(
  s1: Record<string, number>,
  s2: Record<string, number>,
): PlayersRadarResponse {
  return {
    scope: 'season',
    season: 2024,
    group: 'hitting',
    players: [
      { id: 1, fullName: 'A', group: 'hitting', stats: s1 },
      { id: 2, fullName: 'B', group: 'hitting', stats: s2 },
    ],
  }
}

describe('pairScores', () => {
  it('normalizes higher-is-better stats to 0–100 with max at 100', () => {
    expect(pairScores(10, 5, true)).toEqual([100, 50])
    expect(pairScores(0, 0, true)).toEqual([0, 0])
  })

  it('normalizes lower-is-better stats so lower raw values score higher', () => {
    const [a, b] = pairScores(3.5, 4.2, false)
    expect(a).toBeGreaterThan(b)
  })

  it('treats non-finite values as 0', () => {
    const [a, b] = pairScores(Number.NaN, 10, true)
    expect(a).toBe(0)
    expect(b).toBe(100)
  })
})

describe('buildCompareMetricRows', () => {
  it('returns empty array when payload is null', () => {
    expect(buildCompareMetricRows(null, 'hitting')).toEqual([])
  })

  it('returns empty when fewer than two players', () => {
    const one: PlayersRadarResponse = {
      scope: 'season',
      season: 2024,
      group: 'hitting',
      players: [{ id: 1, fullName: 'A', group: 'hitting', stats: {} }],
    }
    expect(buildCompareMetricRows(one, 'hitting')).toEqual([])
  })

  it('builds hitting rows with default 0 for missing stats', () => {
    const rows = buildCompareMetricRows(
      radarPayload({ avg: 0.3 }, { avg: 0.25 }),
      'hitting',
    )
    expect(rows).toHaveLength(HITTING_COMPARE_AXES.length)
    const avgRow = rows.find((r) => r.key === 'avg')
    expect(avgRow?.v1).toBe(0.3)
    expect(avgRow?.v2).toBe(0.25)
    expect(avgRow?.a).toBe(100)
    expect(avgRow?.b).toBeCloseTo((0.25 / 0.3) * 100)
  })

  it('uses pitching axes when group is pitching', () => {
    const rows = buildCompareMetricRows(
      radarPayload({ era: 3, whip: 1 }, { era: 4, whip: 1.2 }),
      'pitching',
    )
    expect(rows).toHaveLength(PITCHING_COMPARE_AXES.length)
    expect(rows.map((r) => r.key)).toEqual(PITCHING_COMPARE_AXES.map((a) => a.key))
  })

  it('treats missing stat keys as 0', () => {
    const payload: PlayersRadarResponse = {
      scope: 'season',
      season: 2024,
      group: 'hitting',
      players: [
        { id: 1, fullName: 'A', group: 'hitting', stats: {} },
        { id: 2, fullName: 'B', group: 'hitting', stats: {} },
      ],
    }
    const rows = buildCompareMetricRows(payload, 'hitting')
    expect(rows[0]?.v1).toBe(0)
    expect(rows[0]?.v2).toBe(0)
  })
})
