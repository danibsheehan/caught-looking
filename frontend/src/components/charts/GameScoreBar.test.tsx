import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameTimelineResponse } from '../../types/api.compat';
import GameScoreBar from './GameScoreBar';

const asyncWait = { timeout: 10_000 };

const timeline: GameTimelineResponse = {
  gamePk: 662001,
  status: 'Final',
  homeTeam: 'Home Club',
  awayTeam: 'Away Club',
  homeId: 200,
  awayId: 100,
  innings: [
    { inning: 1, homeRuns: 0, awayRuns: 2 },
    { inning: 2, homeRuns: 1, awayRuns: 0 },
  ],
  homeTotal: 1,
  awayTotal: 2,
};

const api = vi.hoisted(() => ({
  fetchGameTimeline: vi.fn(() => Promise.resolve(timeline)),
}));

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/client')>();
  return {
    ...actual,
    fetchGameTimeline: api.fetchGameTimeline,
  };
});

describe('GameScoreBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchGameTimeline.mockResolvedValue(timeline);
  });

  it('exposes a visually hidden runs-by-inning table', async () => {
    render(<GameScoreBar gamePk={662001} />);

    expect(
      await screen.findByRole(
        'table',
        { name: /Away Club at Home Club runs by inning/i },
        asyncWait,
      ),
    ).toBeInTheDocument();

    await waitFor(() => expect(api.fetchGameTimeline).toHaveBeenCalled(), asyncWait);

    expect(screen.getByRole('columnheader', { name: 'Inning' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Away Club' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /1 2 0/ })).toBeInTheDocument();
  });
});
