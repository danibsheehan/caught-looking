import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlayersGameLogResponse } from '../../types/api.compat'
import PlayerCompareRecentSparklines from './PlayerCompareRecentSparklines'

const rollingTrailingMeanMock = vi.fn(
  (values: number[], _window: number) => values,
)

vi.mock('../../utils/rollingMean', () => ({
  rollingTrailingMean: (values: number[], window: number) =>
    rollingTrailingMeanMock(values, window),
}))

const sample: PlayersGameLogResponse = {
  season: 2026,
  group: 'hitting',
  metric: 'ops',
  limit: 28,
  players: [
    {
      id: 1,
      fullName: 'Player A',
      games: [
        { date: '2026-04-01', gamePk: 1, value: 1.1 },
        { date: '2026-04-02', gamePk: 2, value: 0.8 },
      ],
    },
    {
      id: 2,
      fullName: 'Player B',
      games: [
        { date: '2026-04-01', gamePk: 3, value: 0.9 },
        { date: '2026-04-02', gamePk: 4, value: 0.7 },
      ],
    },
  ],
  leagueBaseline: 0.72,
}

describe('PlayerCompareRecentSparklines', () => {
  beforeEach(() => {
    rollingTrailingMeanMock.mockClear()
  })

  it('recomputes rolling series when window changes', async () => {
    const user = userEvent.setup()
    render(<PlayerCompareRecentSparklines data={sample} />)

    expect(
      rollingTrailingMeanMock.mock.calls.some(([, window]) => window === 10),
    ).toBe(true)

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Rolling average window' }),
      '3',
    )

    await waitFor(() => {
      expect(
        rollingTrailingMeanMock.mock.calls.some(([, window]) => window === 3),
      ).toBe(true)
    })
  })
})
