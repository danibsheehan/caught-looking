import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GamesForDateResponse, TeamsResponse } from '../types/api.compat';
import GamesSlate from './GamesSlate';

const asyncWait = { timeout: 10_000 };

const api = vi.hoisted(() => {
  const teams: TeamsResponse = {
    teams: [
      {
        id: 121,
        name: 'Mets',
        abbreviation: 'NYM',
        teamName: 'New York Mets',
        leagueId: 104,
        leagueName: 'National League',
        divisionId: 201,
        divisionName: 'NL East',
        active: true,
      },
    ],
  };

  const gamesForDate: GamesForDateResponse = {
    date: '2026-04-22',
    games: [],
  };

  return {
    teams,
    gamesForDate,
    fetchTeams: vi.fn(() => Promise.resolve(teams)),
    fetchGamesForDate: vi.fn(() => Promise.resolve(gamesForDate)),
  };
});

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    fetchTeams: api.fetchTeams,
    fetchGamesForDate: api.fetchGamesForDate,
  };
});

function renderGamesSlate(initialPath = '/games') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/games" element={<GamesSlate />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GamesSlate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads teams and slate for the selected date', async () => {
    renderGamesSlate('/games');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Games' }, asyncWait),
    ).toBeInTheDocument();
    expect(screen.getByText(/Pick a date \(and optionally a team\)/i)).toBeInTheDocument();

    await waitFor(() => expect(api.fetchTeams).toHaveBeenCalled(), asyncWait);
    await waitFor(() => expect(api.fetchGamesForDate).toHaveBeenCalled(), asyncWait);

    expect(api.fetchGamesForDate).toHaveBeenCalledWith(
      expect.objectContaining({
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
      expect.any(AbortSignal),
    );

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Games on this day' }, asyncWait),
    ).toBeInTheDocument();
    expect(screen.getByText(/No games on this date/i)).toBeInTheDocument();
  });

  it('renders a populated games list with scores and links to each game', async () => {
    api.fetchGamesForDate.mockResolvedValueOnce({
      date: '2026-04-22',
      games: [
        {
          gamePk: 12345,
          awayTeam: 'Mets',
          homeTeam: 'Phillies',
          awayId: 121,
          homeId: 143,
          status: 'Final',
          awayScore: 5,
          homeScore: 2,
        },
      ],
    });
    renderGamesSlate('/games?date=2026-04-22');

    const link = await screen.findByRole('link', { name: /Mets @ Phillies/i }, asyncWait);
    expect(link).toHaveAttribute('href', '/games/12345?date=2026-04-22');
    expect(screen.getByText(/5–2 · Final/)).toBeInTheDocument();
  });

  it('shows — instead of a score for games that have not started', async () => {
    api.fetchGamesForDate.mockResolvedValueOnce({
      date: '2026-04-22',
      games: [
        {
          gamePk: 12346,
          awayTeam: 'Mets',
          homeTeam: 'Phillies',
          awayId: 121,
          homeId: 143,
          status: 'Scheduled',
          awayScore: 0,
          homeScore: 0,
        },
      ],
    });
    renderGamesSlate('/games?date=2026-04-22');

    await screen.findByText(/— · Scheduled/, {}, asyncWait);
  });

  it('falls back to all teams when the team query param is invalid', async () => {
    renderGamesSlate('/games?team=not-a-number');

    await waitFor(() => expect(api.fetchGamesForDate).toHaveBeenCalled(), asyncWait);
    expect(api.fetchGamesForDate).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: undefined }),
      expect.any(AbortSignal),
    );
  });

  it('updates the date and team query params when the controls change', async () => {
    const user = userEvent.setup();
    renderGamesSlate('/games');
    await waitFor(() => expect(api.fetchTeams).toHaveBeenCalled(), asyncWait);

    const dateInput = await screen.findByLabelText('Date', {}, asyncWait);
    fireEvent.change(dateInput, { target: { value: '2026-05-01' } });
    await waitFor(
      () =>
        expect(api.fetchGamesForDate).toHaveBeenCalledWith(
          expect.objectContaining({ date: '2026-05-01' }),
          expect.any(AbortSignal),
        ),
      asyncWait,
    );

    const teamSelect = await screen.findByLabelText('Team (optional)', {}, asyncWait);
    await user.selectOptions(teamSelect, '121');
    await waitFor(
      () =>
        expect(api.fetchGamesForDate).toHaveBeenCalledWith(
          expect.objectContaining({ teamId: 121 }),
          expect.any(AbortSignal),
        ),
      asyncWait,
    );

    await user.selectOptions(teamSelect, '');
    await waitFor(
      () =>
        expect(api.fetchGamesForDate).toHaveBeenCalledWith(
          expect.objectContaining({ teamId: undefined }),
          expect.any(AbortSignal),
        ),
      asyncWait,
    );
  });
});
