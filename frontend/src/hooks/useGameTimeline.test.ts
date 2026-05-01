import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchGameTimeline } from '../api/client'
import type { GameTimelineResponse } from '../types/api.compat'
import { useGameTimeline } from './useGameTimeline'

vi.mock('../api/client', () => ({
  fetchGameTimeline: vi.fn(),
}))

const mockTimeline: GameTimelineResponse = {
  gamePk: 662000,
  awayTeam: 'Away',
  homeTeam: 'Home',
  awayId: 121,
  homeId: 144,
  innings: [],
  awayTotal: 0,
  homeTotal: 0,
}

describe('useGameTimeline', () => {
  beforeEach(() => {
    vi.mocked(fetchGameTimeline).mockReset()
  })

  it('does not fetch when pk is null or non-finite', () => {
    renderHook(() => useGameTimeline(null))
    expect(fetchGameTimeline).not.toHaveBeenCalled()

    renderHook(() => useGameTimeline(Number.NaN))
    expect(fetchGameTimeline).not.toHaveBeenCalled()

    renderHook(() => useGameTimeline(0))
    expect(fetchGameTimeline).not.toHaveBeenCalled()
  })

  it('loads timeline for a valid pk', async () => {
    vi.mocked(fetchGameTimeline).mockResolvedValue(mockTimeline)

    const { result } = renderHook(() => useGameTimeline(662000))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetchGameTimeline).toHaveBeenCalledWith(662000)
    expect(result.current.data).toEqual(mockTimeline)
  })

  it('surfaces errors', async () => {
    vi.mocked(fetchGameTimeline).mockRejectedValue(new Error('timeline down'))

    const { result } = renderHook(() => useGameTimeline(662000))

    await waitFor(() =>
      expect(result.current.error?.message).toBe('timeline down'),
    )
  })
})
