import { startTransition, useEffect, useState } from 'react'
import { fetchStandings, fetchTeamSeasonStats, fetchTeams } from '../api/client'
import type {
  StandingsQuery,
  StandingsResponse,
  TeamSeasonStatsResponse,
  TeamsQuery,
  TeamsResponse,
} from '../types/api.compat'

export function useStandings(params: StandingsQuery = {}) {
  const { season, leagueId, standingsTypes } = params
  const [data, setData] = useState<StandingsResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      if (cancelled) return
      setLoading(true)
      setError(null)
      fetchStandings({ season, leagueId, standingsTypes })
        .then((json) => {
          if (!cancelled) setData(json)
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
  }, [season, leagueId, standingsTypes])

  return { data, error, loading }
}

export function useTeamSeasonStats(teamId: number | '', season: number) {
  const valid = typeof teamId === 'number' && teamId > 0
  const [data, setData] = useState<TeamSeasonStatsResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!valid) return

    let cancelled = false
    startTransition(() => {
      setLoading(true)
      setError(null)
    })
    fetchTeamSeasonStats(teamId, { season })
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e : new Error(String(e)))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [valid, teamId, season])

  return {
    data: valid ? data : null,
    error: valid ? error : null,
    loading: valid && loading,
  }
}

export function useTeams(params: TeamsQuery = {}) {
  const { sportId } = params
  const [data, setData] = useState<TeamsResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      if (cancelled) return
      setLoading(true)
      setError(null)
      fetchTeams({ sportId })
        .then((json) => {
          if (!cancelled) setData(json)
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
  }, [sportId])

  return { data, error, loading }
}
