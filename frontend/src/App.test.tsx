import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type {
  GameBoxscoreResponse,
  GameStatcastPitchesResponse,
  GameStatcastResponse,
  GameTimelineResponse,
  PlayerCurrentTeamResponse,
  PlayersGameLogResponse,
  PlayersPlatoonResponse,
  PlayersRadarResponse,
  PlayersYearByYearResponse,
  RecordTimelineResponse,
  RecordTimelinesBatchResponse,
  StandingsResponse,
  TeamsResponse,
} from './types/api.compat'

/** CI + coverage runs can exceed Testing Library’s default 1000ms wait. */
const asyncWait = { timeout: 10_000 }

const api = vi.hoisted(() => {
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
          },
        ],
      },
    ],
  }

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

  const box: GameBoxscoreResponse = {
    gamePk: 662000,
    away: {
      teamId: 121,
      teamName: 'Away',
      totals: { runs: 3, hits: 8, errors: 0 },
      batting: [],
      pitching: [],
    },
    home: {
      teamId: 144,
      teamName: 'Home',
      totals: { runs: 2, hits: 6, errors: 1 },
      batting: [],
      pitching: [],
    },
  }

  const statcast: GameStatcastResponse = {
    gamePk: 662000,
    battedBalls: [],
  }

  const pitches: GameStatcastPitchesResponse = {
    gamePk: 662000,
    pitches: [],
  }

  const compare: PlayersRadarResponse = {
    scope: 'season',
    season: 2026,
    group: 'hitting',
    players: [
      { id: 660271, fullName: 'Shohei Ohtani', group: 'hitting', stats: { ops: 0.9 } },
      { id: 592450, fullName: 'Aaron Judge', group: 'hitting', stats: { ops: 0.85 } },
    ],
  }

  const yearly: PlayersYearByYearResponse = {
    group: 'hitting',
    metric: 'ops',
    players: [
      { id: 660271, fullName: 'Shohei Ohtani', points: [{ season: 2026, value: 0.9 }] },
      { id: 592450, fullName: 'Aaron Judge', points: [{ season: 2026, value: 0.85 }] },
    ],
    leagueBySeason: { '2026': 0.75 },
  }

  const gameLog: PlayersGameLogResponse = {
    season: 2026,
    group: 'hitting',
    metric: 'ops',
    limit: 28,
    players: [
      { id: 660271, fullName: 'Shohei Ohtani', games: [] },
      { id: 592450, fullName: 'Aaron Judge', games: [] },
    ],
    leagueBaseline: 0.75,
  }

  const platoon: PlayersPlatoonResponse = {
    season: 2026,
    group: 'hitting',
    metric: 'ops',
    players: [
      {
        id: 660271,
        fullName: 'Shohei Ohtani',
        splits: [
          { code: 'vl', description: 'vs Left', ops: 0.9, sample: 100 },
          { code: 'vr', description: 'vs Right', ops: 0.85, sample: 400 },
        ],
      },
      {
        id: 592450,
        fullName: 'Aaron Judge',
        splits: [
          { code: 'vl', description: 'vs Left', ops: 1.0, sample: 90 },
          { code: 'vr', description: 'vs Right', ops: 0.88, sample: 410 },
        ],
      },
    ],
  }

  const currentTeam = (id: number): PlayerCurrentTeamResponse => ({
    playerId: id,
    teamId: id === 660271 ? 119 : 147,
  })

  const timelinesBatch: RecordTimelinesBatchResponse = {
    season: 2026,
    timelines: [],
  }

  const recordTimeline: RecordTimelineResponse = {
    teamId: 121,
    season: 2026,
    points: [],
    finishedGames: 0,
  }

  const gameTimeline: GameTimelineResponse = {
    gamePk: 662000,
    homeTeam: 'Home',
    awayTeam: 'Away',
    homeId: 144,
    awayId: 121,
    innings: [],
    homeTotal: 2,
    awayTotal: 3,
  }

  return {
    standings,
    teams,
    box,
    statcast,
    pitches,
    compare,
    yearly,
    gameLog,
    currentTeam,
    timelinesBatch,
    recordTimeline,
    gameTimeline,
    fetchStandings: vi.fn(() => Promise.resolve(standings)),
    fetchTeams: vi.fn(() => Promise.resolve(teams)),
    fetchRecordTimelinesBatch: vi.fn(() => Promise.resolve(timelinesBatch)),
    fetchRecordTimeline: vi.fn(() => Promise.resolve(recordTimeline)),
    fetchGameTimeline: vi.fn(() => Promise.resolve(gameTimeline)),
    fetchGameBoxscore: vi.fn(() => Promise.resolve(box)),
    fetchGameStatcast: vi.fn(() => Promise.resolve(statcast)),
    fetchGameStatcastPitches: vi.fn(() => Promise.resolve(pitches)),
    fetchPlayersCompare: vi.fn(() => Promise.resolve(compare)),
    fetchPlayerCurrentTeam: vi.fn((id: number) => Promise.resolve(currentTeam(id))),
    fetchPlayersCompareYearByYear: vi.fn(() => Promise.resolve(yearly)),
    fetchPlayersCompareGameLog: vi.fn(() => Promise.resolve(gameLog)),
    fetchPlayersComparePlatoon: vi.fn(() => Promise.resolve(platoon)),
  }
})

vi.mock('./api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client')>()
  return {
    ...actual,
    fetchStandings: api.fetchStandings,
    fetchTeams: api.fetchTeams,
    fetchRecordTimelinesBatch: api.fetchRecordTimelinesBatch,
    fetchRecordTimeline: api.fetchRecordTimeline,
    fetchGameTimeline: api.fetchGameTimeline,
    fetchGameBoxscore: api.fetchGameBoxscore,
    fetchGameStatcast: api.fetchGameStatcast,
    fetchGameStatcastPitches: api.fetchGameStatcastPitches,
    fetchPlayersCompare: api.fetchPlayersCompare,
    fetchPlayerCurrentTeam: api.fetchPlayerCurrentTeam,
    fetchPlayersCompareYearByYear: api.fetchPlayersCompareYearByYear,
    fetchPlayersCompareGameLog: api.fetchPlayersCompareGameLog,
    fetchPlayersComparePlatoon: api.fetchPlayersComparePlatoon,
  }
})

function renderRoute(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects / to standings and loads standings data', async () => {
    renderRoute('/')
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Standings' })).toBeInTheDocument()
    }, asyncWait)
    expect(screen.getByText(/Wins by team/i)).toBeInTheDocument()
    await waitFor(() => expect(api.fetchStandings).toHaveBeenCalled(), asyncWait)
    await waitFor(() => expect(api.fetchTeams).toHaveBeenCalled(), asyncWait)
    await waitFor(() => expect(api.fetchRecordTimelinesBatch).toHaveBeenCalled(), asyncWait)
  })

  it('shows game detail for /games/:gamePk and fetches box score + statcast', async () => {
    renderRoute('/games/662000')
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Box score' })).toBeInTheDocument()
    }, asyncWait)
    await waitFor(() => expect(api.fetchGameBoxscore).toHaveBeenCalledWith(662000), asyncWait)
    await waitFor(() => expect(api.fetchGameStatcast).toHaveBeenCalledWith(662000), asyncWait)
    await waitFor(() => expect(api.fetchGameStatcastPitches).toHaveBeenCalledWith(662000), asyncWait)
    await waitFor(() => expect(api.fetchGameTimeline).toHaveBeenCalled(), asyncWait)
  })

  it('shows player comparison and issues compare API calls', async () => {
    renderRoute('/players')
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: 'Player comparison' }),
      ).toBeInTheDocument()
    }, asyncWait)
    await waitFor(() => expect(api.fetchPlayersCompare).toHaveBeenCalled(), asyncWait)
    await waitFor(() => expect(api.fetchPlayersCompareYearByYear).not.toHaveBeenCalled(), asyncWait)
    await waitFor(() => expect(api.fetchPlayersCompareGameLog).toHaveBeenCalled(), asyncWait)
    await waitFor(() => expect(api.fetchPlayersComparePlatoon).toHaveBeenCalled(), asyncWait)
    await waitFor(() => expect(api.fetchPlayerCurrentTeam).toHaveBeenCalled(), asyncWait)
  })

  it('loads year-by-year data only after switching Compare to Career', async () => {
    const user = userEvent.setup()
    renderRoute('/players')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: 'Player comparison' }),
      ).toBeInTheDocument()
    }, asyncWait)

    await waitFor(() => expect(api.fetchPlayersCompareGameLog).toHaveBeenCalled(), asyncWait)
    await waitFor(() => expect(api.fetchPlayersComparePlatoon).toHaveBeenCalled(), asyncWait)
    await waitFor(
      () => expect(api.fetchPlayersCompareYearByYear).not.toHaveBeenCalled(),
      asyncWait,
    )

    vi.clearAllMocks()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Compare' }), 'career')

    await waitFor(() => expect(api.fetchPlayersCompareYearByYear).toHaveBeenCalled(), asyncWait)
    expect(api.fetchPlayersCompareGameLog).not.toHaveBeenCalled()
    expect(api.fetchPlayersComparePlatoon).not.toHaveBeenCalled()
  })

  it('navigates from Standings to Players via primary nav', async () => {
    const user = userEvent.setup()
    renderRoute('/standings')
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Standings' })).toBeInTheDocument()
    }, asyncWait)
    await user.click(screen.getByRole('link', { name: 'Players' }))
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: 'Player comparison' }),
      ).toBeInTheDocument()
    }, asyncWait)
  })
})
