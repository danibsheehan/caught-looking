import { fetchStandings, fetchTeamSeasonStats, fetchTeams } from '../api/client';
import type {
  StandingsQuery,
  StandingsResponse,
  TeamSeasonStatsResponse,
  TeamsQuery,
  TeamsResponse,
} from '../types/api.compat';
import { useAsyncResource, useGatedAsyncResource } from './useAsyncResource';

export function useStandings(params: StandingsQuery = {}) {
  const { season, leagueId, standingsTypes } = params;
  return useAsyncResource<StandingsResponse>(
    {
      fetch: (signal) => fetchStandings({ season, leagueId, standingsTypes }, signal),
    },
    [season, leagueId, standingsTypes],
  );
}

export function useTeamSeasonStats(teamId: number | '', season: number) {
  const valid = typeof teamId === 'number' && teamId > 0;
  return useGatedAsyncResource<TeamSeasonStatsResponse>(
    {
      enabled: valid,
      initialPending: false,
      fetch: (signal) => fetchTeamSeasonStats(teamId as number, { season }, signal),
    },
    [valid, teamId, season],
  );
}

export function useTeams(params: TeamsQuery = {}) {
  const { sportId } = params;
  return useAsyncResource<TeamsResponse>(
    {
      fetch: (signal) => fetchTeams({ sportId }, signal),
    },
    [sportId],
  );
}
