import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  RecordTimelineResponse,
  StandingsResponse,
  TeamSeasonStatsResponse,
  TeamsResponse,
} from '../types/api.compat';
import TeamOverview from './TeamOverview';

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
            runsScored: 80,
            runsAllowed: 70,
            runDifferential: 10,
          },
        ],
      },
    ],
  };

  const seasonStats: TeamSeasonStatsResponse = {
    season: 2026,
    teamId: 121,
    hitting: {
      gamesPlayed: 15,
      runs: 75,
      runsPerGame: 5,
      doubles: 28,
      stolenBases: 12,
    },
    pitching: { gamesPlayed: 15, runsAllowed: 60, runsAllowedPerGame: 4 },
    venueSplits: {
      home: { games: 0, wins: 0, losses: 0, runsScored: 0, runsAllowed: 0 },
      away: { games: 0, wins: 0, losses: 0, runsScored: 0, runsAllowed: 0 },
    },
  };

  const recordTimeline: RecordTimelineResponse = {
    teamId: 121,
    season: 2026,
    points: [],
    finishedGames: 0,
  };

  return {
    teams,
    standings,
    seasonStats,
    recordTimeline,
    fetchTeams: vi.fn(() => Promise.resolve(teams)),
    fetchStandings: vi.fn(() => Promise.resolve(standings)),
    fetchTeamSeasonStats: vi.fn(() => Promise.resolve(seasonStats)),
    fetchRecordTimeline: vi.fn(() => Promise.resolve(recordTimeline)),
  };
});

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    fetchTeams: api.fetchTeams,
    fetchStandings: api.fetchStandings,
    fetchTeamSeasonStats: api.fetchTeamSeasonStats,
    fetchRecordTimeline: api.fetchRecordTimeline,
  };
});

function renderTeamOverview() {
  return render(
    <MemoryRouter initialEntries={['/teams']}>
      <Routes>
        <Route path="/teams" element={<TeamOverview />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TeamOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchTeams.mockResolvedValue(api.teams);
    api.fetchStandings.mockResolvedValue(api.standings);
    api.fetchTeamSeasonStats.mockResolvedValue(api.seasonStats);
    api.fetchRecordTimeline.mockResolvedValue(api.recordTimeline);
  });

  it('loads teams and standings, then charts after selecting a club', async () => {
    const user = userEvent.setup();
    renderTeamOverview();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Teams' }, asyncWait),
    ).toBeInTheDocument();
    expect(screen.getByText(/Division charts \(win %, run differential/i)).toBeInTheDocument();

    await waitFor(() => expect(api.fetchTeams).toHaveBeenCalled(), asyncWait);
    await waitFor(() => expect(api.fetchStandings).toHaveBeenCalled(), asyncWait);

    expect(screen.getByText(/Choose a team to load snapshot/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Club' }), '121');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Season snapshot' }, asyncWait),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Runs scored vs. allowed',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Game-by-game results' }),
    ).toBeInTheDocument();

    await waitFor(
      () =>
        expect(api.fetchTeamSeasonStats).toHaveBeenCalledWith(
          121,
          { season: 2026 },
          expect.any(AbortSignal),
        ),
      asyncWait,
    );
    await waitFor(() => expect(api.fetchRecordTimeline).toHaveBeenCalled(), asyncWait);
  });

  it('shows API error state when teams request fails', async () => {
    api.fetchTeams.mockRejectedValueOnce(new Error('teams failed'));
    renderTeamOverview();

    expect(await screen.findByRole('alert', {}, asyncWait)).toHaveTextContent('teams failed');
    expect(screen.getByRole('heading', { level: 1, name: 'Teams' })).toBeInTheDocument();
  });

  it('shows no standings row and no games copy for selected team', async () => {
    const user = userEvent.setup();
    api.fetchStandings.mockResolvedValueOnce({ season: 2026, divisions: [] });
    renderTeamOverview();

    await screen.findByRole('heading', { level: 1, name: 'Teams' }, asyncWait);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Club' }), '121');

    expect(
      await screen.findByText(/No standings row for this club and season yet/i, {}, asyncWait),
    ).toBeInTheDocument();
    const noGames = await screen.findAllByText(
      /No completed games in this sample yet/i,
      {},
      asyncWait,
    );
    expect(noGames.length).toBeGreaterThan(0);
  });

  it('switches tabs and conditionally renders trend vs deep-dive sections', async () => {
    const user = userEvent.setup();
    renderTeamOverview();

    await screen.findByRole('heading', { level: 1, name: 'Teams' }, asyncWait);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Club' }), '121');

    expect(
      await screen.findByRole('heading', { level: 2, name: /^Division race$/i }, asyncWait),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        level: 2,
        name: /Team stats \(season\)/i,
      }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Deep dive' }));
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Team stats (season)',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        level: 2,
        name: /^Division race$/i,
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Home and road' })).toBeInTheDocument();
  });

  it('formats zero/dash standings values and highlights a non-leader team in a 3-team division', async () => {
    const user = userEvent.setup();
    api.fetchTeams.mockResolvedValueOnce({
      teams: [
        api.teams.teams[0]!,
        {
          id: 144,
          name: 'Braves',
          abbreviation: 'ATL',
          teamName: 'Atlanta Braves',
          leagueId: 104,
          leagueName: 'National League',
          divisionId: 201,
          divisionName: 'NL East',
          active: true,
        },
        {
          id: 143,
          name: 'Phillies',
          abbreviation: 'PHI',
          teamName: 'Philadelphia Phillies',
          leagueId: 104,
          leagueName: 'National League',
          divisionId: 201,
          divisionName: 'NL East',
          active: true,
        },
      ],
    });
    api.fetchStandings.mockResolvedValueOnce({
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
              wins: 12,
              losses: 3,
              pct: '.800',
              gamesPlayed: 15,
              divisionRank: '1',
              gamesBack: '-',
              wildCardGamesBack: '-',
              runsScored: 90,
              runsAllowed: 60,
              runDifferential: 30,
            },
            {
              teamId: 144,
              teamName: 'Braves',
              wins: 10,
              losses: 5,
              pct: '.667',
              gamesPlayed: 15,
              divisionRank: '2',
              gamesBack: '2',
              wildCardGamesBack: '-',
              runsScored: 75,
              runsAllowed: 70,
              runDifferential: 5,
            },
            {
              teamId: 143,
              teamName: 'Phillies',
              wins: 7,
              losses: 8,
              pct: '.467',
              gamesPlayed: 15,
              divisionRank: '3',
              gamesBack: '5.5',
              wildCardGamesBack: '1',
              runsScored: 70,
              runsAllowed: 70,
              runDifferential: 0,
            },
          ],
        },
      ],
    });
    api.fetchTeamSeasonStats.mockResolvedValueOnce({ ...api.seasonStats, teamId: 143 });
    api.fetchRecordTimeline.mockResolvedValueOnce({ ...api.recordTimeline, teamId: 143 });

    renderTeamOverview();
    await screen.findByRole('heading', { level: 1, name: 'Teams' }, asyncWait);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Club' }), '143');

    await screen.findByRole('heading', { level: 2, name: 'Season snapshot' }, asyncWait);
    expect(screen.getByText('5.5')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
