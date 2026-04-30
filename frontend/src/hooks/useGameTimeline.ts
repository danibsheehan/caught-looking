import { fetchGameTimeline } from '../api/client'
import type { GameTimelineResponse } from '../types/api.compat'
import { useAsyncResource, type AsyncResourceResult } from './useAsyncResource'

/**
 * @param pk Resolved game primary key, or null when invalid / missing.
 */
export function useGameTimeline(pk: number | null): AsyncResourceResult<GameTimelineResponse> {
  const enabled = pk != null && Number.isFinite(pk) && pk > 0
  return useAsyncResource(
    {
      enabled,
      initialPending: false,
      resetOnDisable: false,
      fetch: () => {
        if (pk == null || !Number.isFinite(pk) || pk <= 0) {
          throw new Error('useGameTimeline: valid pk required')
        }
        return fetchGameTimeline(pk)
      },
    },
    [pk],
  )
}
