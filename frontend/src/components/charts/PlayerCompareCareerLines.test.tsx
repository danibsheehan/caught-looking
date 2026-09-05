import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PlayersYearByYearResponse } from '../../types/api.compat';
import PlayerCompareCareerLines from './PlayerCompareCareerLines';

const sample: PlayersYearByYearResponse = {
  group: 'hitting',
  metric: 'ops',
  players: [
    {
      id: 1,
      fullName: 'Player A',
      points: [
        { season: 2022, value: 0.8 },
        { season: 2023, value: 0.85 },
      ],
    },
    {
      id: 2,
      fullName: 'Player B',
      points: [
        { season: 2022, value: 0.75 },
        { season: 2023, value: 0.9 },
      ],
    },
  ],
  leagueBySeason: { '2022': 0.72, '2023': 0.74 },
};

describe('PlayerCompareCareerLines', () => {
  it('renders an a11y data table with year-by-year values for both players', () => {
    render(<PlayerCompareCareerLines data={sample} />);
    const table = screen.getByRole('table', {
      name: /Year-by-year OPS for Player A and Player B/i,
    });
    expect(table).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Player A' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Player B' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /2023/ })).toBeInTheDocument();
  });

  it('shows an empty state when neither player has year-by-year points', () => {
    const empty: PlayersYearByYearResponse = {
      group: 'hitting',
      metric: 'ops',
      players: [
        { id: 1, fullName: 'Player A', points: [] },
        { id: 2, fullName: 'Player B', points: [] },
      ],
      leagueBySeason: {},
    };
    render(<PlayerCompareCareerLines data={empty} />);
    expect(screen.getByText(/No year-by-year data for this comparison/i)).toBeInTheDocument();
  });
});
