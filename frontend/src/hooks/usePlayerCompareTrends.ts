import {
  fetchPlayersCompareGameLog,
  fetchPlayersComparePlatoon,
  fetchPlayersCompareYearByYear,
} from '../api/client';
import type {
  PlayersGameLogResponse,
  PlayersPlatoonResponse,
  PlayersYearByYearResponse,
  YearByYearMetric,
} from '../types/api.compat';
import { useGatedAsyncResource } from './useAsyncResource';

export function usePlayerCompareYearByYear(
  ids: string,
  group: 'hitting' | 'pitching',
  enabled: boolean,
  metric: YearByYearMetric,
) {
  const inactive = !enabled || !ids;

  return useGatedAsyncResource<PlayersYearByYearResponse>(
    {
      enabled: !inactive,
      initialPending: false,
      fetch: (signal) => fetchPlayersCompareYearByYear({ ids, group, metric }, signal),
    },
    [ids, group, inactive, metric],
  );
}

export function usePlayerCompareGameLog(
  ids: string,
  season: number,
  group: 'hitting' | 'pitching',
  enabled: boolean,
  limit = 28,
) {
  const inactive = !enabled || !ids || season < 1900;

  return useGatedAsyncResource<PlayersGameLogResponse>(
    {
      enabled: !inactive,
      initialPending: false,
      fetch: (signal) => fetchPlayersCompareGameLog({ ids, season, group, limit }, signal),
    },
    [ids, season, group, inactive, limit],
  );
}

export function usePlayerComparePlatoon(
  ids: string,
  season: number,
  group: 'hitting' | 'pitching',
  enabled: boolean,
) {
  const inactive = !enabled || !ids || season < 1900;

  return useGatedAsyncResource<PlayersPlatoonResponse>(
    {
      enabled: !inactive,
      initialPending: false,
      fetch: (signal) => fetchPlayersComparePlatoon({ ids, season, group }, signal),
    },
    [ids, season, group, inactive],
  );
}
