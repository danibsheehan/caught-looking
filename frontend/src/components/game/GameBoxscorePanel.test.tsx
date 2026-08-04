import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  GameBoxscoreResponse,
  GameStatcastPitchesResponse,
  GameTimelineResponse,
} from '../../types/api.compat';
import GameBoxscorePanel from './GameBoxscorePanel';

const asyncWait = { timeout: 10_000 };

const timeline: GameTimelineResponse = {
  gamePk: 662001,
  homeTeam: 'Home Club',
  awayTeam: 'Away Club',
  homeId: 200,
  awayId: 100,
  innings: [{ inning: 1, homeRuns: 0, awayRuns: 2 }],
  homeTotal: 0,
  awayTotal: 2,
};

const api = vi.hoisted(() => ({
  fetchGameTimeline: vi.fn(() => Promise.resolve(timeline)),
}));

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/client')>();
  return {
    ...actual,
    fetchGameTimeline: api.fetchGameTimeline,
  };
});

const box: GameBoxscoreResponse = {
  gamePk: 662001,
  away: {
    teamId: 100,
    teamName: 'Away Club',
    totals: { runs: 3, hits: 8, errors: 0, leftOnBase: 5 },
    pitching: [
      {
        playerId: 1,
        name: 'Zeta Pitcher',
        ip: '7.0',
        h: 4,
        r: 1,
        er: 1,
        bb: 1,
        so: 8,
        hr: 0,
      },
      {
        playerId: 2,
        name: 'Alpha Pitcher',
        ip: '1.0',
        h: 2,
        r: 2,
        er: 2,
        bb: 0,
        so: 1,
        hr: 1,
      },
    ],
    batting: [
      {
        playerId: 10,
        name: 'Pat Batter',
        pos: 'LF',
        ab: 4,
        r: 1,
        h: 2,
        doubles: 1,
        triples: 0,
        hr: 0,
        rbi: 1,
        bb: 0,
        so: 1,
      },
    ],
  },
  home: {
    teamId: 200,
    teamName: 'Home Club',
    totals: { runs: 2, hits: 6, errors: 1 },
    pitching: [
      {
        playerId: 3,
        name: 'Home Ace',
        ip: '9.0',
        h: 6,
        r: 2,
        er: 2,
        bb: 2,
        so: 10,
        hr: 0,
      },
    ],
    batting: [],
  },
};

describe('GameBoxscorePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders team totals, pitching, and batting without runs-by-inning when gamePk is omitted', () => {
    render(<GameBoxscorePanel data={box} />);

    expect(screen.getByRole('heading', { name: 'Team totals', level: 2 })).toBeInTheDocument();
    const awayTotals = screen
      .getAllByRole('heading', { name: 'Away Club', level: 3 })[0]!
      .closest('.game-boxscore__team-totals')! as HTMLElement;
    const runsLabel = within(awayTotals).getByText('R', { exact: true });
    expect(runsLabel.tagName.toLowerCase()).toBe('dt');
    expect(runsLabel.nextElementSibling).toHaveTextContent('3');
    expect(
      screen.queryByRole('heading', { name: 'Runs by inning', level: 2 }),
    ).not.toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Pitching', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Zeta Pitcher')).toBeInTheDocument();
    expect(screen.getByText('Home Ace')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Batting', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Pat Batter')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Pitch location', level: 2 }),
    ).not.toBeInTheDocument();
  });

  it('loads inning chart data when gamePk is provided', async () => {
    render(<GameBoxscorePanel data={box} gamePk={662001} />);

    expect(screen.getByRole('heading', { name: 'Runs by inning', level: 2 })).toBeInTheDocument();
    await waitFor(
      () => expect(api.fetchGameTimeline).toHaveBeenCalledWith(662001, expect.any(AbortSignal)),
      asyncWait,
    );
    expect(
      await screen.findByRole(
        'table',
        { name: /Away Club at Home Club runs by inning/i },
        asyncWait,
      ),
    ).toBeInTheDocument();
  });

  it('shows pitch-location loading and error states', () => {
    const { rerender } = render(
      <GameBoxscorePanel data={box} pitchLocation={{ loading: true, error: null, data: null }} />,
    );
    expect(screen.getByText('Loading pitch data…')).toBeInTheDocument();

    rerender(
      <GameBoxscorePanel
        data={box}
        pitchLocation={{
          loading: false,
          error: new Error('statcast unavailable'),
          data: null,
        }}
      />,
    );
    expect(screen.getByText(/statcast unavailable/i)).toBeInTheDocument();
  });

  it('renders pitch-location panel when pitch data resolves', () => {
    const pitches: GameStatcastPitchesResponse = {
      gamePk: 662001,
      pitches: [],
    };
    render(
      <GameBoxscorePanel
        data={box}
        pitchLocation={{ loading: false, error: null, data: pitches }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Pitch location', level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/No pitch tracking data for this game/i)).toBeInTheDocument();
  });

  it('re-sorts away pitching when toggling the IP column', async () => {
    const user = userEvent.setup();
    render(<GameBoxscorePanel data={box} />);

    const tables = screen.getAllByRole('table');
    const awayPitching = tables[0]!;
    const ipBtn = within(awayPitching).getByRole('button', { name: /^IP/ });

    await user.click(ipBtn);
    await user.click(ipBtn);

    const bodyRows = within(awayPitching).getAllByRole('row').slice(1);
    expect(bodyRows[0]).toHaveTextContent('Alpha Pitcher');
    expect(bodyRows[1]).toHaveTextContent('Zeta Pitcher');
  });
});
