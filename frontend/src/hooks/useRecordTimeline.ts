import { fetchRecordTimeline } from '../api/client';
import type { RecordTimelineResponse } from '../types/api.compat';
import { useAsyncResource, type AsyncResourceResult } from './useAsyncResource';

export function useRecordTimeline(
  teamId: number | null | undefined,
  season: number | null | undefined,
): AsyncResourceResult<RecordTimelineResponse> {
  const enabled = teamId != null && season != null;
  return useAsyncResource(
    {
      enabled,
      initialPending: false,
      resetOnDisable: false,
      fetch: (signal) => {
        if (teamId == null || season == null) {
          throw new Error('useRecordTimeline: teamId and season required');
        }
        return fetchRecordTimeline(teamId, { season }, signal);
      },
    },
    [teamId, season],
  );
}
