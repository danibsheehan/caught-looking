import {
  fetchPlayersCompareGameLog,
  fetchPlayersComparePlatoon,
  fetchPlayersCompareYearByYear,
} from '../api/client'
import type {
  PlayersGameLogResponse,
  PlayersPlatoonResponse,
  PlayersYearByYearResponse,
  YearByYearMetric,
} from '../types/api.compat'
import { useAsyncResource } from './useAsyncResource'

export function usePlayerCompareYearByYear(
  ids: string,
  group: 'hitting' | 'pitching',
  enabled: boolean,
  metric: YearByYearMetric,
) {
  const inactive = !enabled || !ids

  const { data, error, loading } = useAsyncResource<PlayersYearByYearResponse>(
    {
      enabled: !inactive,
      initialPending: false,
      fetch: (signal) =>
        fetchPlayersCompareYearByYear({ ids, group, metric }, signal),
    },
    [ids, group, inactive, metric],
  )

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
  const inactive = !enabled || !ids || season < 1900

  const { data, error, loading } = useAsyncResource<PlayersGameLogResponse>(
    {
      enabled: !inactive,
      initialPending: false,
      fetch: (signal) =>
        fetchPlayersCompareGameLog({ ids, season, group, limit }, signal),
    },
    [ids, season, group, inactive, limit],
  )

  return {
    data: inactive ? null : data,
    error: inactive ? null : error,
    loading: inactive ? false : loading,
  }
}

export function usePlayerComparePlatoon(
  ids: string,
  season: number,
  group: 'hitting' | 'pitching',
  enabled: boolean,
) {
  const inactive = !enabled || !ids || season < 1900

  const { data, error, loading } = useAsyncResource<PlayersPlatoonResponse>(
    {
      enabled: !inactive,
      initialPending: false,
      fetch: (signal) =>
        fetchPlayersComparePlatoon({ ids, season, group }, signal),
    },
    [ids, season, group, inactive],
  )

  return {
    data: inactive ? null : data,
    error: inactive ? null : error,
    loading: inactive ? false : loading,
  }
}
