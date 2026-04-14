import { useEffect, useState } from 'react'
import { fetchStandings, fetchTeams } from '../api/client.js'

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
