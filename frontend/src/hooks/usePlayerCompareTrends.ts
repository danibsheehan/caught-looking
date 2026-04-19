import { useEffect, useState } from 'react'
import {
  fetchPlayersCompareGameLog,
  fetchPlayersCompareYearByYear,
} from '../api/client'
import type {
  PlayersGameLogResponse,
  PlayersYearByYearResponse,
} from '../types/api'

export function usePlayerCompareYearByYear(
  ids: string,
  group: 'hitting' | 'pitching',
  enabled: boolean,
) {
  const [data, setData] = useState<PlayersYearByYearResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)

  const inactive = !enabled || !ids

  useEffect(() => {
    if (inactive) return
    let cancelled = false
    const t = setTimeout(() => {
      if (cancelled) return
      setLoading(true)
      setError(null)
      fetchPlayersCompareYearByYear({ ids, group })
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
  }, [ids, group, inactive])

  return {
    data: inactive ? null : data,
    error: inactive ? null : error,
    loading: inactive ? false : loading,
  }
}

export function usePlayerCompareGameLog(
  ids: string,
  season: number,
  group: 'hitting' | 'pitching',
  enabled: boolean,
  limit = 28,
) {
  const [data, setData] = useState<PlayersGameLogResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)

  const inactive = !enabled || !ids || season < 1900

  useEffect(() => {
    if (inactive) return
    let cancelled = false
    const t = setTimeout(() => {
      if (cancelled) return
      setLoading(true)
      setError(null)
      fetchPlayersCompareGameLog({ ids, season, group, limit })
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
  }, [ids, season, group, inactive, limit])

  return {
    data: inactive ? null : data,
    error: inactive ? null : error,
    loading: inactive ? false : loading,
  }
}
