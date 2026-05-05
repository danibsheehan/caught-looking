import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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
});
