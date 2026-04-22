import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecordTimelinesBatchResponse, StandingsResponse, TeamsResponse } from '../types/api'
import Standings from './Standings'

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
          },
        ],
      },
    ],
  }

  const timelinesBatch: RecordTimelinesBatchResponse = {
    season: 2026,
    timelines: [],
  }

  return {
    teams,
    standings,
    timelinesBatch,
    fetchTeams: vi.fn(() => Promise.resolve(teams)),
    fetchStandings: vi.fn(() => Promise.resolve(standings)),
    fetchRecordTimelinesBatch: vi.fn(() => Promise.resolve(timelinesBatch)),
  }
})

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    fetchTeams: api.fetchTeams,
    fetchStandings: api.fetchStandings,
    fetchRecordTimelinesBatch: api.fetchRecordTimelinesBatch,
  }
})

function renderStandings() {
  return render(
    <MemoryRouter initialEntries={['/standings']}>
      <Routes>
        <Route path="/standings" element={<Standings />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Standings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders division panels and chart sections after data loads', async () => {
    renderStandings()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Standings' }, asyncWait),
    ).toBeInTheDocument()

    expect(screen.getByText(/regular season · AL/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Wins by team' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Cumulative win % vs games played' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'NL East' })).toBeInTheDocument()

    const table = screen.getByRole('table')
    expect(within(table).getByRole('columnheader', { name: 'Team' })).toBeInTheDocument()
    expect(within(table).getByText('Mets')).toBeInTheDocument()

    await waitFor(() => expect(api.fetchStandings).toHaveBeenCalled(), asyncWait)
    await waitFor(() => expect(api.fetchTeams).toHaveBeenCalled(), asyncWait)
    await waitFor(
      () =>
        expect(api.fetchRecordTimelinesBatch).toHaveBeenCalledWith({
          teamIds: [121],
          season: 2026,
        }),
      asyncWait,
    )
  })
})
