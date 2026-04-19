import { useEffect, useState } from 'react'
import { fetchPlayersCompare } from '../api/client'
import type { PlayersRadarResponse } from '../types/api'

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
  const [data, setData] = useState<PlayersRadarResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)

  const needSeason = scope === 'season'
  const inactive =
    !enabled ||
    playerId1 == null ||
    playerId2 == null ||
    (needSeason && season == null) ||
    playerId1 === playerId2

  useEffect(() => {
    if (inactive) return

    let cancelled = false
    const ids = `${playerId1},${playerId2}`
    const t = setTimeout(() => {
      if (cancelled) return
      setLoading(true)
      setError(null)
      fetchPlayersCompare({
        ids,
        scope,
        ...(needSeason && season != null ? { season } : {}),
        group,
      })
        .then((d) => {
          if (!cancelled) setData(d)
        })
        .catch((e) => {
          if (!cancelled)
            setError(e instanceof Error ? e : new Error(String(e)))
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [inactive, needSeason, playerId1, playerId2, season, scope, group])

  return {
    data: inactive ? null : data,
    error: inactive ? null : error,
    loading: inactive ? false : loading,
  }
}
