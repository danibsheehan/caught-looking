import {
  fetchGameBoxscore,
  fetchGameStatcast,
  fetchGameStatcastPitches,
} from '../api/client'
import type {
  GameBoxscoreResponse,
  GameStatcastPitchesResponse,
  GameStatcastResponse,
} from '../types/api.compat'
import { useAsyncResource, type AsyncResourceResult } from './useAsyncResource'

export type GameDetailData = {
  box: AsyncResourceResult<GameBoxscoreResponse>
  statcast: AsyncResourceResult<GameStatcastResponse>
  pitches: AsyncResourceResult<GameStatcastPitchesResponse>
}

/**
 * Loads box score, Statcast batted balls, and Statcast pitch rows for a game.
 * Each slice loads independently (parallel requests, independent errors).
 */
export function useGameDetailData(gamePk: number | null): GameDetailData {
  const pkReady = gamePk != null

  const box = useAsyncResource<GameBoxscoreResponse>(
    {
      enabled: pkReady,
      initialPending: true,
      clearDataBeforeFetch: true,
      fetch: (signal) => {
        if (gamePk == null) throw new Error('useGameDetailData: gamePk required')
        return fetchGameBoxscore(gamePk, signal)
      },
    },
    [gamePk],
  )

  const statcast = useAsyncResource<GameStatcastResponse>(
    {
      enabled: pkReady,
      initialPending: true,
      clearDataBeforeFetch: true,
      fetch: (signal) => {
        if (gamePk == null) throw new Error('useGameDetailData: gamePk required')
        return fetchGameStatcast(gamePk, signal)
      },
    },
    [gamePk],
  )

  const pitches = useAsyncResource<GameStatcastPitchesResponse>(
    {
      enabled: pkReady,
      initialPending: true,
      clearDataBeforeFetch: true,
      fetch: (signal) => {
        if (gamePk == null) throw new Error('useGameDetailData: gamePk required')
        return fetchGameStatcastPitches(gamePk, signal)
      },
    },
    [gamePk],
  )

  return { box, statcast, pitches }
}
