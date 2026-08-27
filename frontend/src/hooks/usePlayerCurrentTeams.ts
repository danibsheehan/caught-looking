import { fetchPlayersCurrentTeams } from '../api/client';
import type { PlayersCurrentTeamsResponse } from '../types/api.compat';
import { useAsyncResource } from './useAsyncResource';

/**
 * Resolves each player's current MLB team id (Stats API) for chart colors.
 * Falls back to null so {@link PlayerRadar} uses default comparison colors.
 * Uses a single batched API request for both players.
 */
export function usePlayerCurrentTeams(
  playerId1: number | null | undefined,
  playerId2: number | null | undefined,
  enabled: boolean,
): { teamId1: number | null; teamId2: number | null } {
  const invalid = !enabled || playerId1 == null || playerId2 == null || playerId1 === playerId2;

  const { data, error } = useAsyncResource<PlayersCurrentTeamsResponse>(
    {
      enabled: !invalid,
      initialPending: false,
      fetch: (signal) => fetchPlayersCurrentTeams(playerId1 as number, playerId2 as number, signal),
    },
    [invalid, playerId1, playerId2],
  );

  // useAsyncResource keeps stale `data` across a failed retry (for polling use cases); this
  // hook has no polling, so any error should fall back to null ids rather than a stale pair.
  if (invalid || !data || error) {
    return { teamId1: null, teamId2: null };
  }
  const [a, b] = data.players;
  return {
    teamId1: a && a.teamId > 0 ? a.teamId : null,
    teamId2: b && b.teamId > 0 ? b.teamId : null,
  };
}
