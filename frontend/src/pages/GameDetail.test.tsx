import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  GameBoxscoreResponse,
  GameStatcastPitchesResponse,
  GameStatcastResponse,
} from '../types/api.compat';
import GameDetail from './GameDetail';

const asyncWait = { timeout: 10_000 };

vi.mock('../utils/gameStatus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/gameStatus')>();
  return {
    ...actual,
    LIVE_GAME_POLL_INTERVAL_MS: 40,
    LIVE_GAME_POLL_MAX_INTERVAL_MS: 200,
  };
});

const api = vi.hoisted(() => {
  const box: GameBoxscoreResponse = {
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

  const statcast: GameStatcastResponse = {
    gamePk: 662000,
    battedBalls: [],
  };

  const pitches: GameStatcastPitchesResponse = {
    gamePk: 662000,
    pitches: [],
  };

  return {
    box,
    statcast,
    pitches,
    fetchGameBoxscore: vi.fn(() => Promise.resolve(box)),
    fetchGameStatcast: vi.fn(() => Promise.resolve(statcast)),
    fetchGameStatcastPitches: vi.fn(() => Promise.resolve(pitches)),
  };
});

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    fetchGameBoxscore: api.fetchGameBoxscore,
    fetchGameStatcast: api.fetchGameStatcast,
    fetchGameStatcastPitches: api.fetchGameStatcastPitches,
  };
});

function renderGameDetail(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/games" element={<p>Games slate</p>} />
        <Route path="/games/:gamePk" element={<GameDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GameDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchGameBoxscore.mockImplementation(() => Promise.resolve(api.box));
    api.fetchGameStatcast.mockImplementation(() => Promise.resolve(api.statcast));
    api.fetchGameStatcastPitches.mockImplementation(() => Promise.resolve(api.pitches));
  });

  it('redirects invalid gamePk to /games', async () => {
    renderGameDetail('/games/not-a-pk');

    expect(await screen.findByText('Games slate', {}, asyncWait)).toBeInTheDocument();
    expect(api.fetchGameBoxscore).not.toHaveBeenCalled();
  });

  it('shows loading copy then box score and batted-ball sections', async () => {
    let resolveBox!: (value: GameBoxscoreResponse) => void;
    api.fetchGameBoxscore.mockImplementation(
      () =>
        new Promise<GameBoxscoreResponse>((resolve) => {
          resolveBox = resolve;
        }),
    );

    renderGameDetail('/games/662000');

    expect(await screen.findByText('Loading box score…', {}, asyncWait)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Box score' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Batted balls' })).toBeInTheDocument();

    resolveBox(api.box);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Team totals' }, asyncWait),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Pitching' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Batting' })).toBeInTheDocument();

    await waitFor(() => expect(api.fetchGameBoxscore).toHaveBeenCalled(), asyncWait);
    await waitFor(() => expect(api.fetchGameStatcast).toHaveBeenCalled(), asyncWait);
    await waitFor(() => expect(api.fetchGameStatcastPitches).toHaveBeenCalled(), asyncWait);

    expect(api.fetchGameBoxscore).toHaveBeenCalledWith(662000, expect.any(AbortSignal));
    expect(api.fetchGameStatcast).toHaveBeenCalledWith(662000, expect.any(AbortSignal));
    expect(api.fetchGameStatcastPitches).toHaveBeenCalledWith(662000, expect.any(AbortSignal));

    expect(
      await screen.findByRole('heading', { level: 3, name: 'Spray (field view)' }, asyncWait),
    ).toBeInTheDocument();
  });

  it('surfaces box score and statcast errors as alerts', async () => {
    api.fetchGameBoxscore.mockRejectedValue(new Error('box unavailable'));
    api.fetchGameStatcast.mockRejectedValue(new Error('statcast unavailable'));

    renderGameDetail('/games/662000');

    const alerts = await screen.findAllByRole('alert', {}, asyncWait);
    expect(alerts).toHaveLength(2);
    expect(alerts.map((el) => el.textContent)).toEqual(
      expect.arrayContaining(['box unavailable', 'statcast unavailable']),
    );
  });

  it('includes the slate date on the back link when provided', async () => {
    renderGameDetail('/games/662000?date=2026-04-22');

    const back = await screen.findByRole('link', { name: /← Games · 2026-04-22/ }, asyncWait);
    expect(back).toHaveAttribute('href', '/games?date=2026-04-22');

    await waitFor(() => expect(api.fetchGameBoxscore).toHaveBeenCalled(), asyncWait);
  });

  it('shows live-poll copy when the game is unsettled', async () => {
    api.fetchGameBoxscore.mockResolvedValue({ ...api.box, status: 'In Progress' });

    renderGameDetail('/games/662000');

    expect(
      await screen.findByText(
        /Live game — box score and timeline refresh about every 45 seconds/i,
        {},
        asyncWait,
      ),
    ).toBeInTheDocument();
  });

  it('hides live-poll copy when the game is Final', async () => {
    renderGameDetail('/games/662000');

    await screen.findByRole('heading', { level: 2, name: 'Team totals' }, asyncWait);
    expect(
      screen.queryByText(/Live game — box score and timeline refresh about every 45 seconds/i),
    ).not.toBeInTheDocument();
  });

  it('keeps prior box score and offers Retry when a live poll fails', async () => {
    const user = userEvent.setup();
    const liveBox = { ...api.box, status: 'In Progress' };
    api.fetchGameBoxscore
      .mockResolvedValueOnce(liveBox)
      .mockRejectedValueOnce(new Error('upstream timeout'))
      .mockResolvedValue(liveBox);

    renderGameDetail('/games/662000');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Team totals' }, asyncWait),
    ).toBeInTheDocument();

    const alert = await screen.findByText(/Could not refresh the box score/i, {}, asyncWait);
    expect(alert).toHaveTextContent(/upstream timeout/);
    expect(alert).toHaveTextContent(/Reconnecting automatically/);
    expect(alert.closest('[role="alert"]')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Team totals' })).toBeInTheDocument();

    const beforeRetry = api.fetchGameBoxscore.mock.calls.length;
    await user.click(screen.getByRole('button', { name: /Retry now/i }));

    await waitFor(() => {
      expect(api.fetchGameBoxscore.mock.calls.length).toBeGreaterThan(beforeRetry);
    }, asyncWait);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Retry now/i })).not.toBeInTheDocument();
    }, asyncWait);
  });
});
