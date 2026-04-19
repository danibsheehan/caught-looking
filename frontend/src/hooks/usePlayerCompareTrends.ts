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

  useEffect(() => {
    if (!enabled || !ids) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }
    let cancelled = false
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
    return () => {
      cancelled = true
    }
  }, [ids, group, enabled])

  return { data, error, loading }
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

  useEffect(() => {
    if (!enabled || !ids || season < 1900) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }
    let cancelled = false
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
    return () => {
      cancelled = true
    }
  }, [ids, season, group, enabled, limit])

  return { data, error, loading }
}
