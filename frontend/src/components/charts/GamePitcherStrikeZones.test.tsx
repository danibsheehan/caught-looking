import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import GamePitcherStrikeZones from './GamePitcherStrikeZones'
import type { GameBoxscoreResponse, StatcastPitch } from '../../types/api'

const samplePitches: StatcastPitch[] = [
  {
    plateX: -0.2,
    plateZ: 2.1,
    pitchName: '4-Seam Fastball',
    pitcher: 42,
    releaseSpeed: 94,
  },
  {
    plateX: 0.4,
    plateZ: 3.0,
    pitchName: 'Slider',
    pitcher: 42,
  },
]

const box: GameBoxscoreResponse = {
  gamePk: 1,
  away: {
    teamId: 100,
    teamName: 'Away Club',
    totals: { runs: 0, hits: 0, errors: 0 },
    batting: [],
    pitching: [
      {
        playerId: 42,
        name: 'Casey Pitcher',
        ip: '6.0',
        h: 0,
        r: 0,
        er: 0,
        bb: 0,
        so: 0,
        hr: 0,
      },
    ],
  },
  home: {
    teamId: 200,
    teamName: 'Home Club',
    totals: { runs: 0, hits: 0, errors: 0 },
    batting: [],
    pitching: [],
  },
}

describe('GamePitcherStrikeZones', () => {
  it('defaults to single-pitcher view with a pitcher select and featured chart', () => {
    render(<GamePitcherStrikeZones pitches={samplePitches} box={box} />)
    expect(screen.getByRole('combobox', { name: /Pitcher/i })).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: /Away Club — Casey Pitcher/ }),
    ).toBeInTheDocument()
    expect(screen.getByText(/4-Seam Fastball 1/)).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /Pitch locations for Casey Pitcher/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Show all pitchers/i })).toBeInTheDocument()
  })

  it('shows the full grid after toggling to all pitchers', async () => {
    const user = userEvent.setup()
    render(<GamePitcherStrikeZones pitches={samplePitches} box={box} />)
    await user.click(screen.getByRole('button', { name: /Show all pitchers/i }))
    expect(screen.getByRole('heading', { name: /Away — Away Club/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Casey Pitcher', level: 3 })).toBeInTheDocument()
  })

  it('shows empty copy when there are no pitches', () => {
    render(<GamePitcherStrikeZones pitches={[]} box={box} />)
    expect(
      screen.getByText(/No pitch tracking data for this game/i),
    ).toBeInTheDocument()
  })
})
