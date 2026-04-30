import { fetchStandings, fetchTeamSeasonStats, fetchTeams } from '../api/client'
import type {
  StandingsQuery,
  StandingsResponse,
  TeamSeasonStatsResponse,
  TeamsQuery,
  TeamsResponse,
} from '../types/api.compat'
import { useAsyncResource } from './useAsyncResource'

export function useStandings(params: StandingsQuery = {}) {
  const { season, leagueId, standingsTypes } = params
  return useAsyncResource<StandingsResponse>(
    {
      fetch: () => fetchStandings({ season, leagueId, standingsTypes }),
    },
    [season, leagueId, standingsTypes],
  )
}

export function useTeamSeasonStats(teamId: number | '', season: number) {
  const valid = typeof teamId === 'number' && teamId > 0
  const { data, error, loading } = useAsyncResource<TeamSeasonStatsResponse>(
    {
      enabled: valid,
      initialPending: false,
      fetch: () => fetchTeamSeasonStats(teamId as number, { season }),
    },
    [valid, teamId, season],
  )
  return {
    data: valid ? data : null,
    error: valid ? error : null,
    loading: valid && loading,
  }
}

export function useTeams(params: TeamsQuery = {}) {
  const { sportId } = params
  return useAsyncResource<TeamsResponse>(
    {
      fetch: () => fetchTeams({ sportId }),
    },
    [sportId],
  )
}
