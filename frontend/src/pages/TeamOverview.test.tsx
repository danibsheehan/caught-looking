import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  RecordTimelineResponse,
  StandingsResponse,
  TeamSeasonStatsResponse,
  TeamsResponse,
} from '../types/api'
import TeamOverview from './TeamOverview'

const asyncWait = { timeout: 10_000 }

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
  }

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
  }

  const seasonStats: TeamSeasonStatsResponse = {
    season: 2026,
    teamId: 121,
    hitting: { gamesPlayed: 15, runs: 75, runsPerGame: 5 },
    pitching: { gamesPlayed: 15, runsAllowed: 60, runsAllowedPerGame: 4 },
  }

  const recordTimeline: RecordTimelineResponse = {
    teamId: 121,
    season: 2026,
    points: [],
    finishedGames: 0,
  }

  return {
    teams,
    standings,
    seasonStats,
    recordTimeline,
    fetchTeams: vi.fn(() => Promise.resolve(teams)),
    fetchStandings: vi.fn(() => Promise.resolve(standings)),
    fetchTeamSeasonStats: vi.fn(() => Promise.resolve(seasonStats)),
    fetchRecordTimeline: vi.fn(() => Promise.resolve(recordTimeline)),
  }
})

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    fetchTeams: api.fetchTeams,
    fetchStandings: api.fetchStandings,
    fetchTeamSeasonStats: api.fetchTeamSeasonStats,
    fetchRecordTimeline: api.fetchRecordTimeline,
  }
})

function renderTeamOverview() {
  return render(
    <MemoryRouter initialEntries={['/teams']}>
      <Routes>
        <Route path="/teams" element={<TeamOverview />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('TeamOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads teams and standings, then charts after selecting a club', async () => {
    const user = userEvent.setup()
    renderTeamOverview()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Teams' }, asyncWait),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Division charts \(win %, run differential/i),
    ).toBeInTheDocument()

    await waitFor(() => expect(api.fetchTeams).toHaveBeenCalled(), asyncWait)
    await waitFor(() => expect(api.fetchStandings).toHaveBeenCalled(), asyncWait)

    expect(screen.getByText(/Choose a team to load snapshot/i)).toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Club' }), '121')

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Season snapshot' }, asyncWait),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Runs scored vs. allowed' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Game-by-game results' })).toBeInTheDocument()

    await waitFor(() => expect(api.fetchTeamSeasonStats).toHaveBeenCalledWith(121, { season: 2026 }), asyncWait)
    await waitFor(() => expect(api.fetchRecordTimeline).toHaveBeenCalled(), asyncWait)
  })
})
