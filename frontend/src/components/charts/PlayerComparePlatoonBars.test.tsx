import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PlayersPlatoonResponse } from '../../types/api.compat';
import PlayerComparePlatoonBars from './PlayerComparePlatoonBars';

const sample: PlayersPlatoonResponse = {
  season: 2024,
  group: 'hitting',
  metric: 'ops',
  players: [
    {
      id: 1,
      fullName: 'Player A',
      splits: [
        { code: 'vl', description: 'vs Left', ops: 0.9, sample: 50 },
        { code: 'vr', description: 'vs Right', ops: 0.8, sample: 200 },
      ],
    },
    {
      id: 2,
      fullName: 'Player B',
      splits: [
        { code: 'vl', description: 'vs Left', ops: 0.85, sample: 55 },
        { code: 'vr', description: 'vs Right', ops: 0.82, sample: 210 },
      ],
    },
  ],
};

describe('PlayerComparePlatoonBars', () => {
  it('renders an a11y data table with player OPS splits', () => {
    render(<PlayerComparePlatoonBars data={sample} />);
    const table = screen.getByRole('table', {
      name: /Platoon OPS splits for Player A and Player B/i,
    });
    expect(table).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Player A' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Player B' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '0.900' })).toBeInTheDocument();
  });

  it('shows empty state when no splits', () => {
    const empty: PlayersPlatoonResponse = {
      season: 2024,
      group: 'hitting',
      metric: 'ops',
      players: [
        { id: 1, fullName: 'A', splits: [] },
        { id: 2, fullName: 'B', splits: [] },
      ],
    };
    render(<PlayerComparePlatoonBars data={empty} />);
    expect(screen.getByText(/No platoon splits/i)).toBeInTheDocument();
  });
});
