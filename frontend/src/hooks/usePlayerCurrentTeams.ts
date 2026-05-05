import { useEffect, useState } from 'react';
import { fetchPlayersCurrentTeams } from '../api/client';
import { isAbortError } from './useAsyncResource';

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
  const [teamId1, setTeamId1] = useState<number | null>(null);
  const [teamId2, setTeamId2] = useState<number | null>(null);

  const invalid = !enabled || playerId1 == null || playerId2 == null || playerId1 === playerId2;

  useEffect(() => {
    if (invalid) return;

    let cancelled = false;
    const ac = new AbortController();
    fetchPlayersCurrentTeams(playerId1, playerId2, ac.signal)
      .then((res) => {
        if (cancelled) return;
        const [a, b] = res.players;
        setTeamId1(a && a.teamId > 0 ? a.teamId : null);
        setTeamId2(b && b.teamId > 0 ? b.teamId : null);
      })
      .catch((e) => {
        if (cancelled || isAbortError(e)) return;
        setTeamId1(null);
        setTeamId2(null);
      });

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [invalid, playerId1, playerId2]);

  return {
    teamId1: invalid ? null : teamId1,
    teamId2: invalid ? null : teamId2,
  };
}
