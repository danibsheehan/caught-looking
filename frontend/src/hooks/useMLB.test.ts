import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchStandings,
  fetchTeamSeasonStats,
  fetchTeams,
} from '../api/client'
import type {
  StandingsResponse,
  TeamSeasonStatsResponse,
  TeamsResponse,
} from '../types/api.compat'
import { useStandings, useTeamSeasonStats, useTeams } from './useMLB'

vi.mock('../api/client', () => ({
  fetchStandings: vi.fn(),
  fetchTeams: vi.fn(),
  fetchTeamSeasonStats: vi.fn(),
}))

const mockStandings: StandingsResponse = {
  season: 2024,
  divisions: [],
}

const mockTeams: TeamsResponse = { teams: [] }

const emptyVenue = {
  home: { games: 0, wins: 0, losses: 0, runsScored: 0, runsAllowed: 0 },
  away: { games: 0, wins: 0, losses: 0, runsScored: 0, runsAllowed: 0 },
}

const mockTeamStats: TeamSeasonStatsResponse = {
  season: 2024,
  teamId: 147,
  hitting: { gamesPlayed: 1, runs: 1, runsPerGame: 1, doubles: 0, stolenBases: 0 },
  pitching: { gamesPlayed: 1, runsAllowed: 1, runsAllowedPerGame: 1 },
  venueSplits: emptyVenue,
}

describe('useStandings', () => {
  beforeEach(() => {
    vi.mocked(fetchStandings).mockReset()
  })

  it('loads standings and passes query params to fetchStandings', async () => {
    vi.mocked(fetchStandings).mockResolvedValue(mockStandings)

    const { result } = renderHook(() =>
      useStandings({ season: 2024, leagueId: '103', standingsTypes: 'regularSeason' }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetchStandings).toHaveBeenCalledWith(
      {
        season: 2024,
        leagueId: '103',
        standingsTypes: 'regularSeason',
      },
      expect.any(AbortSignal),
    )
    expect(result.current.data).toEqual(mockStandings)
    expect(result.current.error).toBeNull()
  })

  it('surfaces fetch errors', async () => {
    vi.mocked(fetchStandings).mockRejectedValue(new Error('network'))

    const { result } = renderHook(() => useStandings())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).toBeNull()
    expect(result.current.error?.message).toBe('network')
  })
})

describe('useTeams', () => {
  beforeEach(() => {
    vi.mocked(fetchTeams).mockReset()
  })

  it('loads teams with sportId', async () => {
    vi.mocked(fetchTeams).mockResolvedValue(mockTeams)

    const { result } = renderHook(() => useTeams({ sportId: '1' }))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetchTeams).toHaveBeenCalledWith({ sportId: '1' }, expect.any(AbortSignal))
    expect(result.current.data).toEqual(mockTeams)
  })
})

describe('useTeamSeasonStats', () => {
  beforeEach(() => {
    vi.mocked(fetchTeamSeasonStats).mockReset()
  })

  it('fetches when teamId is a positive number', async () => {
    vi.mocked(fetchTeamSeasonStats).mockResolvedValue(mockTeamStats)

    const { result } = renderHook(() => useTeamSeasonStats(147, 2024))

    await waitFor(() => expect(result.current.data).toEqual(mockTeamStats))

    expect(fetchTeamSeasonStats).toHaveBeenCalledWith(
      147,
      { season: 2024 },
      expect.any(AbortSignal),
    )
    expect(result.current.error).toBeNull()
  })

  it('does not fetch and returns empty state when teamId is invalid', () => {
    const { result } = renderHook(() => useTeamSeasonStats('', 2024))

    expect(fetchTeamSeasonStats).not.toHaveBeenCalled()
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('records errors from fetchTeamSeasonStats', async () => {
    vi.mocked(fetchTeamSeasonStats).mockRejectedValue(new Error('stats failed'))

    const { result } = renderHook(() => useTeamSeasonStats(147, 2024))

    await waitFor(() =>
      expect(result.current.error?.message).toBe('stats failed'),
    )
  })
})
