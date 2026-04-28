import { describe, expect, it } from 'vitest'
import { buildPitcherStrikeZoneRows } from './gameStatcastPitchers'
import type { GameBoxscoreResponse, StatcastPitch } from '../types/api.compat'

const pitch = (
  pitcher: number,
  overrides: Partial<StatcastPitch> = {},
): StatcastPitch => ({
  plateX: 0,
  plateZ: 2,
  pitcher,
  pitchName: '4-Seam Fastball',
  ...overrides,
})

describe('buildPitcherStrikeZoneRows', () => {
  it('orders pitchers by away then home box lines when box is present', () => {
    const box: GameBoxscoreResponse = {
      gamePk: 1,
      away: {
        teamId: 1,
        teamName: 'Away',
        totals: { runs: 0, hits: 0, errors: 0 },
        batting: [],
        pitching: [
          {
            playerId: 10,
            name: 'A Reliever',
            ip: '1.0',
            h: 0,
            r: 0,
            er: 0,
            bb: 0,
            so: 0,
            hr: 0,
          },
        ],
      },
      home: {
        teamId: 2,
        teamName: 'Home',
        totals: { runs: 0, hits: 0, errors: 0 },
        batting: [],
        pitching: [
          {
            playerId: 20,
            name: 'H Starter',
            ip: '6.0',
            h: 0,
            r: 0,
            er: 0,
            bb: 0,
            so: 0,
            hr: 0,
          },
        ],
      },
    }
    const pitches = [pitch(20), pitch(10)]
    const rows = buildPitcherStrikeZoneRows(pitches, box)
    expect(rows.map((r) => r.id)).toEqual([10, 20])
    expect(rows[0]?.name).toBe('A Reliever')
    expect(rows[0]?.side).toBe('away')
    expect(rows[1]?.name).toBe('H Starter')
    expect(rows[1]?.side).toBe('home')
  })

  it('appends tracking-only pitcher ids after box order', () => {
    const box: GameBoxscoreResponse = {
      gamePk: 1,
      away: {
        teamId: 1,
        teamName: 'Away',
        totals: { runs: 0, hits: 0, errors: 0 },
        batting: [],
        pitching: [],
      },
      home: {
        teamId: 2,
        teamName: 'Home',
        totals: { runs: 0, hits: 0, errors: 0 },
        batting: [],
        pitching: [
          {
            playerId: 20,
            name: 'H Starter',
            ip: '6.0',
            h: 0,
            r: 0,
            er: 0,
            bb: 0,
            so: 0,
            hr: 0,
          },
        ],
      },
    }
    const pitches = [pitch(99), pitch(20)]
    const rows = buildPitcherStrikeZoneRows(pitches, box)
    expect(rows.map((r) => r.id)).toEqual([20, 99])
    expect(rows[1]?.name).toBe('Player 99')
    expect(rows[1]?.side).toBe('unknown')
  })
})
