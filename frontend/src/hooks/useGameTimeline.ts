import { fetchGameTimeline } from '../api/client';
import type { GameTimelineResponse } from '../types/api.compat';
import {
  LIVE_GAME_POLL_INTERVAL_MS,
  LIVE_GAME_POLL_MAX_INTERVAL_MS,
  gameStatusSettled,
} from '../utils/gameStatus';
import { useAsyncResource, type AsyncResourceResult } from './useAsyncResource';

/**
 * @param pk Resolved game primary key, or null when invalid / missing.
 * Polls while the game is unsettled (same cadence as box score live TTL).
 */
export function useGameTimeline(pk: number | null): AsyncResourceResult<GameTimelineResponse> {
  const enabled = pk != null && Number.isFinite(pk) && pk > 0;
  return useAsyncResource(
    {
      enabled,
      initialPending: false,
      resetOnDisable: false,
      fetch: (signal) => {
        if (pk == null || !Number.isFinite(pk) || pk <= 0) {
          throw new Error('useGameTimeline: valid pk required');
        }
        return fetchGameTimeline(pk, signal);
      },
      poll: {
        intervalMs: LIVE_GAME_POLL_INTERVAL_MS,
        maxIntervalMs: LIVE_GAME_POLL_MAX_INTERVAL_MS,
        while: (data) => !gameStatusSettled(data.status),
      },
    },
    [pk],
  );
}
