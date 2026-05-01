import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchPlayersCompareGameLog,
  fetchPlayersComparePlatoon,
  fetchPlayersCompareYearByYear,
} from '../api/client'
import type {
  PlayersGameLogResponse,
  PlayersPlatoonResponse,
  PlayersYearByYearResponse,
} from '../types/api.compat'
import {
  usePlayerCompareGameLog,
  usePlayerComparePlatoon,
  usePlayerCompareYearByYear,
} from './usePlayerCompareTrends'

vi.mock('../api/client', () => ({
  fetchPlayersCompareYearByYear: vi.fn(),
  fetchPlayersCompareGameLog: vi.fn(),
  fetchPlayersComparePlatoon: vi.fn(),
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

const mockPlatoon: PlayersPlatoonResponse = {
  season: 2024,
  group: 'hitting',
  metric: 'ops',
  players: [],
}

describe('usePlayerCompareYearByYear', () => {
  beforeEach(() => {
    vi.mocked(fetchPlayersCompareYearByYear).mockReset()
  })

  it('does not fetch when disabled or ids empty', () => {
    renderHook(() => usePlayerCompareYearByYear('1,2', 'hitting', false, 'ops'))
    expect(fetchPlayersCompareYearByYear).not.toHaveBeenCalled()

    const { result: empty } = renderHook(() =>
      usePlayerCompareYearByYear('', 'hitting', true, 'ops'),
    )
    expect(fetchPlayersCompareYearByYear).not.toHaveBeenCalled()
    expect(empty.current.data).toBeNull()
  })

  it('loads year-by-year data', async () => {
    vi.mocked(fetchPlayersCompareYearByYear).mockResolvedValue(mockYearByYear)

    const { result } = renderHook(() =>
      usePlayerCompareYearByYear('10,20', 'pitching', true, 'era'),
    )

    await waitFor(() => expect(result.current.data).toEqual(mockYearByYear))

    expect(fetchPlayersCompareYearByYear).toHaveBeenCalledWith(
      {
        ids: '10,20',
        group: 'pitching',
        metric: 'era',
      },
      expect.any(AbortSignal),
    )
  })

  it('surfaces errors', async () => {
    vi.mocked(fetchPlayersCompareYearByYear).mockRejectedValue(new Error('yby'))

    const { result } = renderHook(() =>
      usePlayerCompareYearByYear('1,2', 'hitting', true, 'ops'),
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

    expect(fetchPlayersCompareGameLog).toHaveBeenCalledWith(
      {
        ids: '1,2',
        season: 2024,
        group: 'pitching',
        limit: 50,
      },
      expect.any(AbortSignal),
    )
  })

  it('surfaces errors', async () => {
    vi.mocked(fetchPlayersCompareGameLog).mockRejectedValue(new Error('gamelog'))

    const { result } = renderHook(() =>
      usePlayerCompareGameLog('1,2', 2024, 'hitting', true),
    )

    await waitFor(() => expect(result.current.error?.message).toBe('gamelog'))
  })
})

describe('usePlayerComparePlatoon', () => {
  beforeEach(() => {
    vi.mocked(fetchPlayersComparePlatoon).mockReset()
  })

  it('does not fetch when season before 1900', () => {
    renderHook(() => usePlayerComparePlatoon('1,2', 1899, 'hitting', true))
    expect(fetchPlayersComparePlatoon).not.toHaveBeenCalled()
  })

  it('fetches platoon splits', async () => {
    vi.mocked(fetchPlayersComparePlatoon).mockResolvedValue(mockPlatoon)

    const { result } = renderHook(() =>
      usePlayerComparePlatoon('5,6', 2024, 'pitching', true),
    )

    await waitFor(() => expect(result.current.data).toEqual(mockPlatoon))
    expect(fetchPlayersComparePlatoon).toHaveBeenCalledWith(
      {
        ids: '5,6',
        season: 2024,
        group: 'pitching',
      },
      expect.any(AbortSignal),
    )
  })
})
