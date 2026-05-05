import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TeamSeasonStatsResponse } from '../../types/api.compat';
import TeamSeasonDeepDive from './TeamSeasonDeepDive';

function makeStats(overrides: Partial<TeamSeasonStatsResponse> = {}): TeamSeasonStatsResponse {
  return {
    season: 2025,
    teamId: 121,
    hitting: {
      gamesPlayed: 12,
      runs: 54,
      runsPerGame: 4.5,
      ops: 0.812,
      obp: 0.341,
      slg: 0.471,
      avg: 0.262,
      doubles: 20,
      stolenBases: 9,
      homeRuns: 13,
      homeRunsPerGame: 1.08,
      isolatedPower: 0.188,
      bbPct: 8.4,
      kPct: 21.1,
      babip: 0.301,
    },
    pitching: {
      gamesPlayed: 12,
      runsAllowed: 47,
      runsAllowedPerGame: 3.92,
      era: 3.88,
      whip: 1.18,
      k9: 9.3,
      bb9: 2.7,
      hr9: 1.02,
      h9: 7.9,
      kbb: 3.45,
    },
    venueSplits: {
      home: {
        games: 6,
        wins: 4,
        losses: 2,
        runsScored: 29,
        runsAllowed: 20,
        runsPerGame: 4.83,
        runsAllowedPerGame: 3.33,
      },
      away: {
        games: 6,
        wins: 3,
        losses: 3,
        runsScored: 25,
        runsAllowed: 27,
        runsPerGame: 4.17,
        runsAllowedPerGame: 4.5,
      },
    },
    ...overrides,
  };
}

describe('TeamSeasonDeepDive', () => {
  it('shows no-data copy when venue splits have no completed games', () => {
    const stats = makeStats({
      hitting: {
        ...makeStats().hitting,
        gamesPlayed: 0,
        runs: 0,
        runsPerGame: 0,
      },
      pitching: {
        ...makeStats().pitching,
        gamesPlayed: 0,
        runsAllowed: 0,
        runsAllowedPerGame: 0,
      },
      venueSplits: {
        home: { games: 0, wins: 0, losses: 0, runsScored: 0, runsAllowed: 0 },
        away: { games: 0, wins: 0, losses: 0, runsScored: 0, runsAllowed: 0 },
      },
    });

    render(<TeamSeasonDeepDive stats={stats} teamId={121} />);

    expect(
      screen.getByText(/No completed home\/road games in this response yet/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Offense' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pitching' })).not.toBeInTheDocument();
  });

  it('renders partial data and fallback labels for missing offense values', () => {
    const base = makeStats();
    const stats = makeStats({
      hitting: {
        ...base.hitting,
        ops: undefined,
        doubles: 0,
        homeRuns: undefined,
        stolenBases: 0,
      },
      pitching: {
        ...base.pitching,
        gamesPlayed: 0,
        runsAllowedPerGame: 0,
        runsAllowed: 0,
      },
      venueSplits: {
        home: {
          games: 0,
          wins: 0,
          losses: 0,
          runsScored: 0,
          runsAllowed: 0,
          runsPerGame: undefined,
          runsAllowedPerGame: undefined,
        },
        away: {
          games: 8,
          wins: 5,
          losses: 3,
          runsScored: 37,
          runsAllowed: 31,
          runsPerGame: 4.63,
          runsAllowedPerGame: 3.88,
        },
      },
    });

    render(<TeamSeasonDeepDive stats={stats} teamId={121} />);

    expect(screen.getByRole('heading', { name: 'Offense' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pitching' })).not.toBeInTheDocument();
    expect(screen.getByText(/2B:/i)).toHaveTextContent('2B: 0');
    expect(screen.getByText(/HR:/i)).toHaveTextContent('HR: 0');
    expect(screen.getByText(/SB:/i)).toHaveTextContent('SB: 0');
    expect(screen.getByLabelText('OPS no data')).toBeInTheDocument();
    const fallbackCells = screen.getAllByRole('cell', { name: '—' });
    expect(fallbackCells.length).toBeGreaterThan(0);
  });

  it('renders full data with offense, pitching, and the combined R/G vs RA/G legend', () => {
    const stats = makeStats();
    render(<TeamSeasonDeepDive stats={stats} teamId={121} />);

    expect(screen.getByRole('heading', { name: 'Offense' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pitching' })).toBeInTheDocument();
    expect(screen.getByText(/Runs per game: offense/i)).toBeInTheDocument();
    expect(screen.getByTitle('R/G 4.50')).toBeInTheDocument();
    expect(screen.getByTitle('RA/G 3.92')).toBeInTheDocument();

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBeGreaterThan(3);
    expect(screen.getByRole('cell', { name: '4.83' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '4.50' })).toBeInTheDocument();
  });
});
