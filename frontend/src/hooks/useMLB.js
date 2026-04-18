import { startTransition, useEffect, useState } from 'react'
import { fetchStandings, fetchTeamSeasonStats, fetchTeams } from '../api/client.js'

/**
 * @typedef {Object} UseStandingsResult
 * @property {import('../types/api').StandingsResponse | null} data
 * @property {Error | null} error
 * @property {boolean} loading
 */

/**
 * @typedef {Object} UseTeamsResult
 * @property {import('../types/api').TeamsResponse | null} data
 * @property {Error | null} error
 * @property {boolean} loading
 */

/**
 * Regular-season standings from the Go API.
 * @param {import('../types/api').StandingsQuery} [params]
 * @returns {UseStandingsResult}
 */
export function useStandings(params = {}) {
  const { season, leagueId, standingsTypes } = params
  const [data, setData] = useState(
    /** @type {import('../types/api').StandingsResponse | null} */ (null),
  )
  const [error, setError] = useState(
    /** @type {Error | null} */ (null),
  )
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

/**
 * Season hitting & pitching aggregates for one team.
 * @param {number | ''} teamId
 * @param {number} season
 * @returns {{ data: import('../types/api').TeamSeasonStatsResponse | null, error: Error | null, loading: boolean }}
 */
export function useTeamSeasonStats(teamId, season) {
  const valid = typeof teamId === 'number' && teamId > 0
  const [data, setData] = useState(
    /** @type {import('../types/api').TeamSeasonStatsResponse | null} */ (null),
  )
  const [error, setError] = useState(/** @type {Error | null} */ (null))
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

/**
 * MLB clubs (defaults to sportId=1) for labels and selectors.
 * @param {import('../types/api').TeamsQuery} [params]
 * @returns {UseTeamsResult}
 */
export function useTeams(params = {}) {
  const { sportId } = params
  const [data, setData] = useState(
    /** @type {import('../types/api').TeamsResponse | null} */ (null),
  )
  const [error, setError] = useState(
    /** @type {Error | null} */ (null),
  )
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
