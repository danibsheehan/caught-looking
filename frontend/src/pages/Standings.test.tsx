import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  RecordTimelinesBatchResponse,
  StandingsResponse,
  TeamsResponse,
} from '../types/api.compat';
import Standings from './Standings';

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
      {
        id: 112,
        name: 'Cubs',
        abbreviation: 'CHC',
        teamName: 'Chicago Cubs',
        leagueId: 104,
        leagueName: 'National League',
        divisionId: 202,
        divisionName: 'NL Central',
        active: true,
      },
    ],
  };

  const standings: StandingsResponse = {
    season: 2026,
    divisions: [
      {
        divisionId: 201,
        divisionName: 'NL East',
        leagueId: 104,
        teams: [
          {
            teamId: 121,
            teamName: 'Mets',
            wins: 10,
            losses: 5,
            pct: '.667',
            gamesPlayed: 15,
            divisionRank: '1',
            gamesBack: '-',
            wildCardGamesBack: '-',
          },
        ],
      },
      {
        divisionId: 202,
        divisionName: 'NL Central',
        leagueId: 104,
        teams: [
          {
            teamId: 112,
            teamName: 'Cubs',
            wins: 9,
            losses: 6,
            pct: '.600',
            gamesPlayed: 15,
            divisionRank: '1',
            gamesBack: '-',
            wildCardGamesBack: '-',
          },
        ],
      },
    ],
  };

  const timelinesBatch: RecordTimelinesBatchResponse = {
    season: 2026,
    timelines: [],
  };

  return {
    teams,
    standings,
    timelinesBatch,
    fetchTeams: vi.fn(() => Promise.resolve(teams)),
    fetchStandings: vi.fn(() => Promise.resolve(standings)),
    fetchRecordTimelinesBatch: vi.fn(() => Promise.resolve(timelinesBatch)),
  };
});

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    fetchTeams: api.fetchTeams,
    fetchStandings: api.fetchStandings,
    fetchRecordTimelinesBatch: api.fetchRecordTimelinesBatch,
  };
});

function renderStandings(path = '/standings') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/standings" element={<Standings />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Standings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders only the selected division table and updates on division change', async () => {
    renderStandings();
    const user = userEvent.setup();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Standings' }, asyncWait),
    ).toBeInTheDocument();

    expect(screen.getByText(/regular season · AL/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Wins by team' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Division race',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'NL East' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'NL Central' })).not.toBeInTheDocument();

    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Team' })).toBeInTheDocument();
    expect(within(table).getByText('Mets')).toBeInTheDocument();
    expect(within(table).queryByText('Cubs')).not.toBeInTheDocument();

    await waitFor(() => expect(api.fetchStandings).toHaveBeenCalled(), asyncWait);
    await waitFor(() => expect(api.fetchTeams).toHaveBeenCalled(), asyncWait);
    await waitFor(
      () =>
        expect(api.fetchRecordTimelinesBatch).toHaveBeenCalledWith(
          {
            teamIds: [121],
            season: 2026,
          },
          expect.any(AbortSignal),
        ),
      asyncWait,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Division' }), '1');

    expect(screen.getByRole('heading', { level: 2, name: 'NL Central' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'NL East' })).not.toBeInTheDocument();

    const updatedTable = screen.getByRole('table');
    expect(within(updatedTable).getByText('Cubs')).toBeInTheDocument();
    expect(within(updatedTable).queryByText('Mets')).not.toBeInTheDocument();

    await waitFor(
      () =>
        expect(api.fetchRecordTimelinesBatch).toHaveBeenCalledWith(
          {
            teamIds: [112],
            season: 2026,
          },
          expect.any(AbortSignal),
        ),
      asyncWait,
    );
  }, 15_000);

  it('does not steal focus into the results panel on ordinary page load', async () => {
    renderStandings();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Standings' }, asyncWait),
    ).toBeInTheDocument();

    await waitFor(() => expect(api.fetchStandings).toHaveBeenCalled(), asyncWait);
    // `selected` goes from undefined (before the fetch resolves) to a real division once
    // standings load -- that transition must not be treated as a user-driven filter change.
    expect(document.activeElement).not.toBe(document.querySelector('.standings-page__results'));
  }, 15_000);

  it('restores division and team focus from the URL', async () => {
    renderStandings('/standings?team=112');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Standings' }, asyncWait),
    ).toBeInTheDocument();

    expect(screen.getByRole('combobox', { name: 'Jump to team' })).toHaveValue('112');
    expect(screen.getByRole('combobox', { name: 'Division' })).toHaveValue('1');
    expect(screen.getByRole('heading', { level: 2, name: 'NL Central' })).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Cubs')).toBeInTheDocument();
  }, 15_000);

  it('restores division from division id when team is absent', async () => {
    renderStandings('/standings?division=202');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Standings' }, asyncWait),
    ).toBeInTheDocument();

    expect(screen.getByRole('combobox', { name: 'Jump to team' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Division' })).toHaveValue('1');
    expect(screen.getByRole('heading', { level: 2, name: 'NL Central' })).toBeInTheDocument();
  }, 15_000);
});
