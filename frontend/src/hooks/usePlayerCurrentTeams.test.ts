import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchPlayersCurrentTeams } from '../api/client'
import type { PlayersCurrentTeamsResponse } from '../types/api.compat'
import { usePlayerCurrentTeams } from './usePlayerCurrentTeams'

vi.mock('../api/client', () => ({
  fetchPlayersCurrentTeams: vi.fn(),
}))

describe('usePlayerCurrentTeams', () => {
  beforeEach(() => {
    vi.mocked(fetchPlayersCurrentTeams).mockReset()
  })

  it('returns null team ids when disabled or invalid', () => {
    const { result: disabled } = renderHook(() =>
      usePlayerCurrentTeams(1, 2, false),
    )
    expect(disabled.current.teamId1).toBeNull()
    expect(disabled.current.teamId2).toBeNull()

    const { result: same } = renderHook(() =>
      usePlayerCurrentTeams(5, 5, true),
    )
    expect(same.current.teamId1).toBeNull()
    expect(fetchPlayersCurrentTeams).not.toHaveBeenCalled()
  })

  it('maps positive team ids from batched response', async () => {
    vi.mocked(fetchPlayersCurrentTeams).mockResolvedValue({
      players: [
        { playerId: 1, teamId: 147 },
        { playerId: 2, teamId: 121 },
      ],
    } as PlayersCurrentTeamsResponse)

    const { result } = renderHook(() => usePlayerCurrentTeams(1, 2, true))

    await waitFor(() => {
      expect(result.current.teamId1).toBe(147)
      expect(result.current.teamId2).toBe(121)
    })

    expect(fetchPlayersCurrentTeams).toHaveBeenCalledTimes(1)
    expect(fetchPlayersCurrentTeams).toHaveBeenCalledWith(
      1,
      2,
      expect.any(AbortSignal),
    )
  })

  it('treats non-positive teamId as null', async () => {
    vi.mocked(fetchPlayersCurrentTeams).mockResolvedValue({
      players: [
        { playerId: 1, teamId: 0 },
        { playerId: 2, teamId: 121 },
      ],
    } as PlayersCurrentTeamsResponse)

    const { result } = renderHook(() => usePlayerCurrentTeams(1, 2, true))

    await waitFor(() => expect(result.current.teamId2).toBe(121))

    expect(result.current.teamId1).toBeNull()
  })

  it('clears team ids when batch request rejects', async () => {
    vi.mocked(fetchPlayersCurrentTeams).mockRejectedValue(new Error('api'))

    const { result } = renderHook(() => usePlayerCurrentTeams(1, 2, true))

    await waitFor(() => {
      expect(result.current.teamId1).toBeNull()
      expect(result.current.teamId2).toBeNull()
    })
  })
})
