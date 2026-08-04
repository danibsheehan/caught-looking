import { fetchLeaders } from '../api/client';
import type { LeadersQuery, LeadersResponse } from '../types/api.compat';
import { useAsyncResource } from './useAsyncResource';

export function useLeaders(params: LeadersQuery = {}) {
  const { season, group, category, limit } = params;
  return useAsyncResource<LeadersResponse>(
    {
      fetch: (signal) => fetchLeaders({ season, group, category, limit }, signal),
      clearDataBeforeFetch: true,
    },
    [season, group, category, limit],
  );
}
