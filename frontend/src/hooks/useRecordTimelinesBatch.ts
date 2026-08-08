import { useMemo } from 'react';
import { fetchRecordTimelinesBatch } from '../api/client';
import type { RecordTimelinesBatchResponse } from '../types/api.compat';
import { useAsyncResource, type AsyncResourceResult } from './useAsyncResource';

export type RecordTimelinesBatchHookResult = AsyncResourceResult<RecordTimelinesBatchResponse> & {
  /** Deduped positive ids, preserving first-seen order (e.g. standings order). */
  orderedIds: number[];
};

export function useRecordTimelinesBatch(
  teamIds: number[],
  season: number | null | undefined,
): RecordTimelinesBatchHookResult {
  const orderedIds = useMemo(() => {
    const seen = new Set<number>();
    const out: number[] = [];
    for (const id of teamIds) {
      if (id > 0 && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    return out;
  }, [teamIds]);

  const enabled = orderedIds.length > 0 && season != null;
  const resource = useAsyncResource<RecordTimelinesBatchResponse>(
    {
      enabled,
      initialPending: false,
      resetOnDisable: false,
      fetch: (signal) =>
        fetchRecordTimelinesBatch(
          {
            teamIds: orderedIds,
            season: season as number,
          },
          signal,
        ),
    },
    [orderedIds, season],
  );

  return { ...resource, orderedIds };
}
