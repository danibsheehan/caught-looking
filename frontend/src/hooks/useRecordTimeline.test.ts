import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchRecordTimeline } from '../api/client'
import type { RecordTimelineResponse } from '../types/api.compat'
import { useRecordTimeline } from './useRecordTimeline'

vi.mock('../api/client', () => ({
  fetchRecordTimeline: vi.fn(),
}))

const mockTimeline: RecordTimelineResponse = {
  teamId: 121,
  season: 2026,
  points: [],
  finishedGames: 0,
}

describe('useRecordTimeline', () => {
  beforeEach(() => {
    vi.mocked(fetchRecordTimeline).mockReset()
  })

  it('does not fetch when teamId or season is missing', () => {
    renderHook(() => useRecordTimeline(null, 2026))
    expect(fetchRecordTimeline).not.toHaveBeenCalled()

    renderHook(() => useRecordTimeline(121, null))
    expect(fetchRecordTimeline).not.toHaveBeenCalled()
  })

  it('loads timeline and forwards args', async () => {
    vi.mocked(fetchRecordTimeline).mockResolvedValue(mockTimeline)

    const { result } = renderHook(() => useRecordTimeline(121, 2026))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetchRecordTimeline).toHaveBeenCalledWith(121, { season: 2026 })
    expect(result.current.data).toEqual(mockTimeline)
    expect(result.current.error).toBeNull()
  })

  it('surfaces errors', async () => {
    vi.mocked(fetchRecordTimeline).mockRejectedValue(new Error('timeline failed'))

    const { result } = renderHook(() => useRecordTimeline(121, 2026))

    await waitFor(() =>
      expect(result.current.error?.message).toBe('timeline failed'),
    )
    expect(result.current.data).toBeNull()
  })
})
