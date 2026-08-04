import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { StatcastBattedBall } from '../../types/api.compat';
import GameStatcastScatter from './GameStatcastScatter';

const balls: StatcastBattedBall[] = [
  {
    batter: 1,
    pitcher: 2,
    playerName: 'Pat Batter',
    launchSpeed: 98.5,
    launchAngle: 22,
    events: 'single',
    inningHalf: 'Top',
  },
];

describe('GameStatcastScatter', () => {
  it('exposes a visually hidden launch-data table', () => {
    render(<GameStatcastScatter battedBalls={balls} />);

    expect(
      screen.getByRole('table', { name: /exit velocity and launch angle/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Pat Batter' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '98.5' })).toBeInTheDocument();
  });
});
