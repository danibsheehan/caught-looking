import { describe, expect, it } from 'vitest'
import type { StandingDivision, TeamsResponse } from '../types/api'
import {
  divisionIndexForTeam,
  sortStandingTeams,
  standingTeamForId,
  teamLabelMap,
} from './standings'

function team(
  id: number,
  rank: string,
  overrides: Partial<StandingDivision['teams'][number]> = {},
): StandingDivision['teams'][number] {
  return {
    teamId: id,
    teamName: `Team ${id}`,
    wins: 0,
    losses: 0,
    pct: '.000',
    gamesPlayed: 0,
    divisionRank: rank,
    gamesBack: '0.0',
    ...overrides,
  }
}

describe('teamLabelMap', () => {
  it('returns empty map for nullish payload', () => {
    expect(teamLabelMap(null).size).toBe(0)
    expect(teamLabelMap(undefined).size).toBe(0)
  })

  it('maps team id to abbreviation, then teamName, then name', () => {
    const payload: TeamsResponse = {
      teams: [
        {
          id: 1,
          name: 'Full',
          abbreviation: 'ABB',
          teamName: 'Club',
          leagueId: 1,
          leagueName: 'AL',
          divisionId: 1,
          divisionName: 'E',
          active: true,
        },
      ],
    }
    expect(teamLabelMap(payload).get(1)).toBe('ABB')
  })

  it('returns empty map when teams array is empty', () => {
    expect(teamLabelMap({ teams: [] }).size).toBe(0)
  })

  it('uses teamName or name when abbreviation is empty', () => {
    const onlyTeamName: TeamsResponse = {
      teams: [
        {
          id: 2,
          name: 'N',
          abbreviation: '',
          teamName: 'TN',
          leagueId: 1,
          leagueName: 'AL',
          divisionId: 1,
          divisionName: 'E',
          active: true,
        },
      ],
    }
    expect(teamLabelMap(onlyTeamName).get(2)).toBe('TN')

    const onlyName: TeamsResponse = {
      teams: [
        {
          id: 3,
          name: 'NM',
          abbreviation: '',
          teamName: '',
          leagueId: 1,
          leagueName: 'AL',
          divisionId: 1,
          divisionName: 'E',
          active: true,
        },
      ],
    }
    expect(teamLabelMap(onlyName).get(3)).toBe('NM')
  })
})

describe('sortStandingTeams', () => {
  it('sorts by numeric divisionRank', () => {
    const sorted = sortStandingTeams([team(2, '3'), team(1, '1'), team(3, '2')])
    expect(sorted.map((t) => t.teamId)).toEqual([1, 3, 2])
  })
})

describe('divisionIndexForTeam', () => {
  const divisions: StandingDivision[] = [
    {
      divisionId: 1,
      divisionName: 'A',
      leagueId: 1,
      teams: [team(10, '1')],
    },
    {
      divisionId: 2,
      divisionName: 'B',
      leagueId: 1,
      teams: [team(20, '1')],
    },
  ]

  it('returns index when team is found', () => {
    expect(divisionIndexForTeam(divisions, 20)).toBe(1)
  })

  it('returns -1 when not found', () => {
    expect(divisionIndexForTeam(divisions, 99)).toBe(-1)
  })
})

describe('standingTeamForId', () => {
  const divisions: StandingDivision[] = [
    {
      divisionId: 1,
      divisionName: 'A',
      leagueId: 1,
      teams: [team(5, '1')],
    },
  ]

  it('returns division and team when found', () => {
    const result = standingTeamForId(divisions, 5)
    expect(result?.team.teamId).toBe(5)
    expect(result?.division.divisionId).toBe(1)
  })

  it('returns null when divisions missing or empty', () => {
    expect(standingTeamForId(undefined, 5)).toBeNull()
    expect(standingTeamForId([], 5)).toBeNull()
  })

  it('returns null when team id is not in any division', () => {
    const divisions: StandingDivision[] = [
      {
        divisionId: 1,
        divisionName: 'A',
        leagueId: 1,
        teams: [team(5, '1')],
      },
    ]
    expect(standingTeamForId(divisions, 999)).toBeNull()
  })
})
