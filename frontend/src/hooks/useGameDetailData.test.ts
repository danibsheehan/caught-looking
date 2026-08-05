import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchGameBoxscore, fetchGameStatcast, fetchGameStatcastPitches } from '../api/client';
import type {
  GameBoxscoreResponse,
  GameStatcastPitchesResponse,
  GameStatcastResponse,
} from '../types/api.compat';
import { useGameDetailData } from './useGameDetailData';

vi.mock('../api/client', () => ({
  fetchGameBoxscore: vi.fn(),
  fetchGameStatcast: vi.fn(),
  fetchGameStatcastPitches: vi.fn(),
}));

const mockBox: GameBoxscoreResponse = {
  gamePk: 662000,
  status: 'Final',
  away: {
    teamId: 121,
    teamName: 'Away',
    totals: { runs: 1, hits: 1, errors: 0 },
    batting: [],
    pitching: [],
  },
  home: {
    teamId: 144,
    teamName: 'Home',
    totals: { runs: 0, hits: 0, errors: 0 },
    batting: [],
    pitching: [],
  },
};

const mockStatcast: GameStatcastResponse = {
  gamePk: 662000,
  battedBalls: [],
};

const mockPitches: GameStatcastPitchesResponse = {
  gamePk: 662000,
  pitches: [],
};

describe('useGameDetailData', () => {
  beforeEach(() => {
    vi.mocked(fetchGameBoxscore).mockReset();
    vi.mocked(fetchGameStatcast).mockReset();
    vi.mocked(fetchGameStatcastPitches).mockReset();
  });

  it('does not fetch when gamePk is null', () => {
    renderHook(() => useGameDetailData(null));

    expect(fetchGameBoxscore).not.toHaveBeenCalled();
    expect(fetchGameStatcast).not.toHaveBeenCalled();
    expect(fetchGameStatcastPitches).not.toHaveBeenCalled();
  });

  it('fetches all three resources with the same gamePk', async () => {
    vi.mocked(fetchGameBoxscore).mockResolvedValue(mockBox);
    vi.mocked(fetchGameStatcast).mockResolvedValue(mockStatcast);
    vi.mocked(fetchGameStatcastPitches).mockResolvedValue(mockPitches);

    const { result } = renderHook(() => useGameDetailData(662000));

    await waitFor(() => expect(result.current.box.loading).toBe(false));
    await waitFor(() => expect(result.current.statcast.loading).toBe(false));
    await waitFor(() => expect(result.current.pitches.loading).toBe(false));

    expect(fetchGameBoxscore).toHaveBeenCalledWith(662000, expect.any(AbortSignal));
    expect(fetchGameStatcast).toHaveBeenCalledWith(662000, expect.any(AbortSignal));
    expect(fetchGameStatcastPitches).toHaveBeenCalledWith(662000, expect.any(AbortSignal));

    expect(result.current.box.data).toEqual(mockBox);
    expect(result.current.statcast.data).toEqual(mockStatcast);
    expect(result.current.pitches.data).toEqual(mockPitches);
    expect(result.current.box.error).toBeNull();
    expect(result.current.statcast.error).toBeNull();
    expect(result.current.pitches.error).toBeNull();
  });

  it('surfaces errors per slice without blocking others', async () => {
    vi.mocked(fetchGameBoxscore).mockResolvedValue(mockBox);
    vi.mocked(fetchGameStatcast).mockRejectedValue(new Error('statcast down'));
    vi.mocked(fetchGameStatcastPitches).mockResolvedValue(mockPitches);

    const { result } = renderHook(() => useGameDetailData(662000));

    await waitFor(() => expect(result.current.box.data).toEqual(mockBox));
    await waitFor(() => expect(result.current.statcast.error?.message).toBe('statcast down'));
    await waitFor(() => expect(result.current.pitches.data).toEqual(mockPitches));

    expect(result.current.box.error).toBeNull();
    expect(result.current.statcast.data).toBeNull();
  });

  it('refetches when gamePk changes', async () => {
    vi.mocked(fetchGameBoxscore).mockResolvedValue(mockBox);
    vi.mocked(fetchGameStatcast).mockResolvedValue(mockStatcast);
    vi.mocked(fetchGameStatcastPitches).mockResolvedValue(mockPitches);

    const { rerender } = renderHook(({ pk }: { pk: number }) => useGameDetailData(pk), {
      initialProps: { pk: 100 },
    });

    await waitFor(() =>
      expect(fetchGameBoxscore).toHaveBeenCalledWith(100, expect.any(AbortSignal)),
    );

    rerender({ pk: 200 });

    await waitFor(() =>
      expect(fetchGameBoxscore).toHaveBeenCalledWith(200, expect.any(AbortSignal)),
    );
    expect(fetchGameBoxscore).toHaveBeenCalledTimes(2);
  });

  it('polls boxscore while In Progress then stops when Final', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(fetchGameBoxscore)
        .mockResolvedValueOnce({ ...mockBox, status: 'In Progress' })
        .mockResolvedValueOnce({ ...mockBox, status: 'Final' });
      vi.mocked(fetchGameStatcast).mockResolvedValue(mockStatcast);
      vi.mocked(fetchGameStatcastPitches).mockResolvedValue(mockPitches);

      const { result } = renderHook(() => useGameDetailData(662000));

      await vi.waitFor(() => expect(result.current.box.data?.status).toBe('In Progress'));
      expect(fetchGameBoxscore).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(45_000);
      await vi.waitFor(() => expect(result.current.box.data?.status).toBe('Final'));
      expect(fetchGameBoxscore).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(45_000);
      expect(fetchGameBoxscore).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
