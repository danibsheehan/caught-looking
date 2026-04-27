import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { PlayersRadarResponse } from '../../types/api'
import PlayerCompareStatsTable from './PlayerCompareStatsTable'

function makeHittingData(): PlayersRadarResponse {
  return {
    scope: 'season',
    season: 2025,
    group: 'hitting',
    players: [
      {
        id: 1,
        fullName: 'Player A',
        group: 'hitting',
        stats: {
          g: 12,
          pa: 50,
          avg: 0.312,
          obp: 0.4,
          slg: 0.5,
          ops: 0.9,
          woba: 0.38,
          runs: 9,
          hits: 16,
          doubles: 3,
          triples: 1,
          hr: 4,
          rbi: 11,
          walks: 7,
          strikeouts: 10,
          stolenBases: 2,
        },
      },
      {
        id: 2,
        fullName: 'Player B',
        group: 'hitting',
        stats: {
          g: 11,
          pa: 46,
          avg: 0.278,
          obp: 0.352,
          slg: 0.49,
          runs: 8,
          hits: 12,
          hr: 3,
          rbi: 9,
        },
      },
    ],
  }
}

describe('PlayerCompareStatsTable', () => {
  it('returns null when a compared player is missing stats', () => {
    const bad: PlayersRadarResponse = {
      scope: 'season',
      season: 2025,
      group: 'hitting',
      players: [
        { id: 1, fullName: 'A', group: 'hitting', stats: { avg: 0.3 } },
        { id: 2, fullName: 'B', group: 'hitting', stats: undefined as unknown as Record<string, number> },
      ],
    }

    const { container } = render(<PlayerCompareStatsTable data={bad} group="hitting" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders hitting rows with slash formatting, fallback dashes, and numeric alignment', () => {
    render(<PlayerCompareStatsTable data={makeHittingData()} group="hitting" />)

    expect(screen.getByRole('columnheader', { name: 'Player A' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Player B' })).toBeInTheDocument()

    const avgRow = screen.getByRole('cell', { name: 'AVG' }).closest('tr')
    expect(avgRow).toBeTruthy()
    if (avgRow) {
      const cells = within(avgRow).getAllByRole('cell')
      expect(cells[1]).toHaveTextContent('.312')
      expect(cells[2]).toHaveTextContent('.278')
      expect(cells[1]).toHaveStyle({ textAlign: 'right' })
      expect(cells[2]).toHaveStyle({ textAlign: 'right' })
    }

    const sbRow = screen.getByRole('cell', { name: 'SB' }).closest('tr')
    expect(sbRow).toBeTruthy()
    if (sbRow) {
      const cells = within(sbRow).getAllByRole('cell')
      expect(cells[1]).toHaveTextContent('2')
      expect(cells[2]).toHaveTextContent('—')
    }
  })

  it('renders pitching rows with baseball IP formatting and fallback player labels', () => {
    const pitching: PlayersRadarResponse = {
      scope: 'season',
      season: 2025,
      group: 'pitching',
      players: [
        {
          id: 7,
          fullName: '',
          group: 'pitching',
          stats: { ip: 12 + 1 / 3, era: 2.347, whip: 1.128, k9: 9.734, bb9: 2.125 },
        },
        {
          id: 8,
          fullName: '',
          group: 'pitching',
          stats: { ip: 15 + 2 / 3, era: 3.555, whip: 1.204, k9: 8.2, bb9: 3.41 },
        },
      ],
    }

    render(<PlayerCompareStatsTable data={pitching} group="pitching" />)
    expect(screen.getByRole('columnheader', { name: 'Player 1' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Player 2' })).toBeInTheDocument()

    const ipRow = screen.getByRole('cell', { name: 'IP' }).closest('tr')
    expect(ipRow).toBeTruthy()
    if (ipRow) {
      const cells = within(ipRow).getAllByRole('cell')
      expect(cells[1]).toHaveTextContent('12.1')
      expect(cells[2]).toHaveTextContent('15.2')
    }

    const eraRow = screen.getByRole('cell', { name: 'ERA' }).closest('tr')
    expect(eraRow).toBeTruthy()
    if (eraRow) {
      const cells = within(eraRow).getAllByRole('cell')
      expect(cells[1]).toHaveTextContent('2.35')
      expect(cells[2]).toHaveTextContent('3.56')
    }
  })
})
