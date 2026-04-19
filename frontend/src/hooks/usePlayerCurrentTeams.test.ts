import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchPlayerCurrentTeam } from '../api/client'
import type { PlayerCurrentTeamResponse } from '../types/api'
import { usePlayerCurrentTeams } from './usePlayerCurrentTeams'

vi.mock('../api/client', () => ({
  fetchPlayerCurrentTeam: vi.fn(),
}))

describe('usePlayerCurrentTeams', () => {
  beforeEach(() => {
    vi.mocked(fetchPlayerCurrentTeam).mockReset()
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
    expect(fetchPlayerCurrentTeam).not.toHaveBeenCalled()
  })

  it('maps positive team ids from both responses', async () => {
    vi.mocked(fetchPlayerCurrentTeam)
      .mockResolvedValueOnce({ playerId: 1, teamId: 147 } as PlayerCurrentTeamResponse)
      .mockResolvedValueOnce({ playerId: 2, teamId: 121 } as PlayerCurrentTeamResponse)

    const { result } = renderHook(() => usePlayerCurrentTeams(1, 2, true))

    await waitFor(() => {
      expect(result.current.teamId1).toBe(147)
      expect(result.current.teamId2).toBe(121)
    })

    expect(fetchPlayerCurrentTeam).toHaveBeenCalledTimes(2)
    expect(fetchPlayerCurrentTeam).toHaveBeenNthCalledWith(1, 1)
    expect(fetchPlayerCurrentTeam).toHaveBeenNthCalledWith(2, 2)
  })

  it('treats non-positive teamId as null', async () => {
    vi.mocked(fetchPlayerCurrentTeam)
      .mockResolvedValueOnce({ playerId: 1, teamId: 0 } as PlayerCurrentTeamResponse)
      .mockResolvedValueOnce({ playerId: 2, teamId: 121 } as PlayerCurrentTeamResponse)

    const { result } = renderHook(() => usePlayerCurrentTeams(1, 2, true))

    await waitFor(() => expect(result.current.teamId2).toBe(121))

    expect(result.current.teamId1).toBeNull()
  })

  it('clears team ids when Promise.all rejects', async () => {
    vi.mocked(fetchPlayerCurrentTeam).mockRejectedValue(new Error('api'))

    const { result } = renderHook(() => usePlayerCurrentTeams(1, 2, true))

    await waitFor(() => {
      expect(result.current.teamId1).toBeNull()
      expect(result.current.teamId2).toBeNull()
    })
  })
})
