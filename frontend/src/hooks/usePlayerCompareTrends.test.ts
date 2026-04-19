import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchPlayersCompareGameLog,
  fetchPlayersCompareYearByYear,
} from '../api/client'
import type { PlayersGameLogResponse, PlayersYearByYearResponse } from '../types/api'
import { usePlayerCompareGameLog, usePlayerCompareYearByYear } from './usePlayerCompareTrends'

vi.mock('../api/client', () => ({
  fetchPlayersCompareYearByYear: vi.fn(),
  fetchPlayersCompareGameLog: vi.fn(),
}))

const mockYearByYear: PlayersYearByYearResponse = {
  group: 'hitting',
  metric: 'ops',
  players: [],
  leagueBySeason: {},
}

const mockGameLog: PlayersGameLogResponse = {
  season: 2024,
  group: 'hitting',
  metric: 'ops',
  limit: 28,
  players: [],
  leagueBaseline: 0.7,
}

describe('usePlayerCompareYearByYear', () => {
  beforeEach(() => {
    vi.mocked(fetchPlayersCompareYearByYear).mockReset()
  })

  it('does not fetch when disabled or ids empty', () => {
    renderHook(() => usePlayerCompareYearByYear('1,2', 'hitting', false))
    expect(fetchPlayersCompareYearByYear).not.toHaveBeenCalled()

    const { result: empty } = renderHook(() =>
      usePlayerCompareYearByYear('', 'hitting', true),
    )
    expect(fetchPlayersCompareYearByYear).not.toHaveBeenCalled()
    expect(empty.current.data).toBeNull()
  })

  it('loads year-by-year data', async () => {
    vi.mocked(fetchPlayersCompareYearByYear).mockResolvedValue(mockYearByYear)

    const { result } = renderHook(() =>
      usePlayerCompareYearByYear('10,20', 'pitching', true),
    )

    await waitFor(() => expect(result.current.data).toEqual(mockYearByYear))

    expect(fetchPlayersCompareYearByYear).toHaveBeenCalledWith({
      ids: '10,20',
      group: 'pitching',
    })
  })

  it('surfaces errors', async () => {
    vi.mocked(fetchPlayersCompareYearByYear).mockRejectedValue(new Error('yby'))

    const { result } = renderHook(() =>
      usePlayerCompareYearByYear('1,2', 'hitting', true),
    )

    await waitFor(() => expect(result.current.error?.message).toBe('yby'))
  })
})

describe('usePlayerCompareGameLog', () => {
  beforeEach(() => {
    vi.mocked(fetchPlayersCompareGameLog).mockReset()
  })

  it('does not fetch when season before 1900', () => {
    const { result } = renderHook(() =>
      usePlayerCompareGameLog('1,2', 1899, 'hitting', true),
    )

    expect(fetchPlayersCompareGameLog).not.toHaveBeenCalled()
    expect(result.current.data).toBeNull()
  })

  it('passes limit and fetches game log', async () => {
    vi.mocked(fetchPlayersCompareGameLog).mockResolvedValue(mockGameLog)

    const { result } = renderHook(() =>
      usePlayerCompareGameLog('1,2', 2024, 'pitching', true, 50),
    )

    await waitFor(() => expect(result.current.data).toEqual(mockGameLog))

    expect(fetchPlayersCompareGameLog).toHaveBeenCalledWith({
      ids: '1,2',
      season: 2024,
      group: 'pitching',
      limit: 50,
    })
  })

  it('surfaces errors', async () => {
    vi.mocked(fetchPlayersCompareGameLog).mockRejectedValue(new Error('gamelog'))

    const { result } = renderHook(() =>
      usePlayerCompareGameLog('1,2', 2024, 'hitting', true),
    )

    await waitFor(() => expect(result.current.error?.message).toBe('gamelog'))
  })
})
