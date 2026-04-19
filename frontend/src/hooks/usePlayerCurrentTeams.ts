import { useEffect, useState } from 'react'
import { fetchPlayerCurrentTeam } from '../api/client'

/**
 * Resolves each player's current MLB team id (Stats API) for chart colors.
 * Falls back to null so {@link PlayerRadar} uses default comparison colors.
 */
export function usePlayerCurrentTeams(
  playerId1: number | null | undefined,
  playerId2: number | null | undefined,
  enabled: boolean,
): { teamId1: number | null; teamId2: number | null } {
  const [teamId1, setTeamId1] = useState<number | null>(null)
  const [teamId2, setTeamId2] = useState<number | null>(null)

  const invalid =
    !enabled ||
    playerId1 == null ||
    playerId2 == null ||
    playerId1 === playerId2

  useEffect(() => {
    if (invalid) return

    let cancelled = false
    Promise.all([
      fetchPlayerCurrentTeam(playerId1),
      fetchPlayerCurrentTeam(playerId2),
    ])
      .then(([a, b]) => {
        if (cancelled) return
        setTeamId1(a.teamId > 0 ? a.teamId : null)
        setTeamId2(b.teamId > 0 ? b.teamId : null)
      })
      .catch(() => {
        if (!cancelled) {
          setTeamId1(null)
          setTeamId2(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [invalid, playerId1, playerId2])

  return {
    teamId1: invalid ? null : teamId1,
    teamId2: invalid ? null : teamId2,
  }
}
