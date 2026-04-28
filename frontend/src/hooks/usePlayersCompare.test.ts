import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchPlayersCompare } from '../api/client'
import type { PlayersRadarResponse } from '../types/api.compat'
import { usePlayersCompare } from './usePlayersCompare'

vi.mock('../api/client', () => ({
  fetchPlayersCompare: vi.fn(),
}))

const baseArgs = {
  playerId1: 660271,
  playerId2: 660670,
  season: 2024 as number | null | undefined,
  scope: 'season' as const,
  group: 'hitting' as const,
  enabled: true,
}

const mockRadar: PlayersRadarResponse = {
  scope: 'season',
  season: 2024,
  group: 'hitting',
  players: [],
}

describe('usePlayersCompare', () => {
  beforeEach(() => {
    vi.mocked(fetchPlayersCompare).mockReset()
  })

  it('does not fetch when disabled', () => {
    const { result } = renderHook(() =>
      usePlayersCompare({ ...baseArgs, enabled: false }),
    )

    expect(fetchPlayersCompare).not.toHaveBeenCalled()
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('does not fetch when player ids are missing or equal', () => {
    const { result: missing } = renderHook(() =>
      usePlayersCompare({ ...baseArgs, playerId1: null, enabled: true }),
    )
    expect(missing.current.data).toBeNull()
    expect(fetchPlayersCompare).not.toHaveBeenCalled()

    const { result: same } = renderHook(() =>
      usePlayersCompare({ ...baseArgs, playerId1: 1, playerId2: 1, enabled: true }),
    )
    expect(same.current.data).toBeNull()
    expect(fetchPlayersCompare).not.toHaveBeenCalled()
  })

  it('requires season when scope is season', () => {
    const { result } = renderHook(() =>
      usePlayersCompare({
        ...baseArgs,
        season: null,
        scope: 'season',
        enabled: true,
      }),
    )

    expect(fetchPlayersCompare).not.toHaveBeenCalled()
    expect(result.current.data).toBeNull()
  })

  it('calls fetchPlayersCompare with ids and scope career without season', async () => {
    vi.mocked(fetchPlayersCompare).mockResolvedValue(mockRadar)

    const { result } = renderHook(() =>
      usePlayersCompare({
        ...baseArgs,
        season: null,
        scope: 'career',
        enabled: true,
      }),
    )

    await waitFor(() => expect(result.current.data).toEqual(mockRadar))

    expect(fetchPlayersCompare).toHaveBeenCalledWith({
      ids: `${baseArgs.playerId1},${baseArgs.playerId2}`,
      scope: 'career',
      group: 'hitting',
    })
  })

  it('includes season for season scope', async () => {
    vi.mocked(fetchPlayersCompare).mockResolvedValue(mockRadar)

    const { result } = renderHook(() =>
      usePlayersCompare({
        ...baseArgs,
        season: 2023,
        scope: 'season',
        enabled: true,
      }),
    )

    await waitFor(() => expect(result.current.data).toEqual(mockRadar))

    expect(fetchPlayersCompare).toHaveBeenCalledWith({
      ids: `${baseArgs.playerId1},${baseArgs.playerId2}`,
      scope: 'season',
      season: 2023,
      group: 'hitting',
    })
    expect(result.current.error).toBeNull()
  })

  it('surfaces errors', async () => {
    vi.mocked(fetchPlayersCompare).mockRejectedValue(new Error('compare failed'))

    const { result } = renderHook(() => usePlayersCompare(baseArgs))

    await waitFor(() =>
      expect(result.current.error?.message).toBe('compare failed'),
    )

    expect(result.current.data).toBeNull()
  })
})
