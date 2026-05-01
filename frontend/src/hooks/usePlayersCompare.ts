import { fetchPlayersCompare } from '../api/client'
import type { PlayersRadarResponse } from '../types/api.compat'
import { useAsyncResource } from './useAsyncResource'

type Args = {
  playerId1: number | null | undefined
  playerId2: number | null | undefined
  season: number | null | undefined
  scope: 'season' | 'career'
  group: 'hitting' | 'pitching'
  enabled: boolean
}

export function usePlayersCompare({
  playerId1,
  playerId2,
  season,
  scope,
  group,
  enabled,
}: Args) {
  const needSeason = scope === 'season'
  const inactive =
    !enabled ||
    playerId1 == null ||
    playerId2 == null ||
    (needSeason && season == null) ||
    playerId1 === playerId2

  const { data, error, loading } = useAsyncResource<PlayersRadarResponse>(
    {
      enabled: !inactive,
      initialPending: false,
      fetch: (signal) =>
        fetchPlayersCompare(
          {
            ids: `${playerId1},${playerId2}`,
            scope,
            ...(needSeason && season != null ? { season } : {}),
            group,
          },
          signal,
        ),
    },
    [inactive, needSeason, playerId1, playerId2, season, scope, group],
  )

  return {
    data: inactive ? null : data,
    error: inactive ? null : error,
    loading: inactive ? false : loading,
  }
}
