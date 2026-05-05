import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PlayersRadarResponse } from '../../types/api.compat';
import PlayerCompareAheadChart from './PlayerCompareAheadChart';

vi.mock('../../hooks/usePlayerCompareChartColors', () => ({
  usePlayerCompareChartColors: () => ({ colorA: '#111111', colorB: '#222222' }),
}));

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
        stats: { avg: 0.3, obp: 0.4, slg: 0.45, ops: 0.9, hr: 20, rbi: 80 },
      },
      {
        id: 2,
        fullName: 'Player B',
        group: 'hitting',
        stats: { avg: 0.24, obp: 0.4, slg: 0.5, ops: 0.81, hr: 20, rbi: 60 },
      },
    ],
  };
}

describe('PlayerCompareAheadChart', () => {
  it('returns null when there are not enough series to compare', () => {
    const incomplete = {
      scope: 'season',
      season: 2025,
      group: 'hitting',
      players: [{ id: 1, fullName: 'Solo', group: 'hitting', stats: { avg: 0.3 } }],
    } as PlayersRadarResponse;

    const { container } = render(<PlayerCompareAheadChart data={incomplete} group="hitting" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders positive/negative/tie rows and legend labels', () => {
    const { container } = render(
      <PlayerCompareAheadChart data={makeHittingData()} group="hitting" />,
    );

    expect(screen.getByLabelText('Series')).toBeInTheDocument();
    expect(screen.getByText('Player A')).toBeInTheDocument();
    expect(screen.getByText('Player B')).toBeInTheDocument();

    expect(container.querySelectorAll('.player-ahead-chart__connector').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.player-ahead-chart__dot--tie').length).toBeGreaterThan(0);
    expect(screen.getByText(/pair-normalized strength/i)).toBeInTheDocument();
  });

  it('shows tooltip with hitting integer and fixed-decimal formatting', () => {
    render(<PlayerCompareAheadChart data={makeHittingData()} group="hitting" />);

    const hrRow = screen.getByText('HR').closest('.player-ahead-chart__row');
    expect(hrRow).toBeTruthy();
    if (hrRow) {
      fireEvent.mouseEnter(hrRow);
    }

    expect(screen.getByRole('tooltip')).toHaveTextContent('Player A: 20');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Player B: 20');

    const avgRow = screen.getByText('AVG').closest('.player-ahead-chart__row');
    expect(avgRow).toBeTruthy();
    if (avgRow) {
      fireEvent.mouseEnter(avgRow);
    }

    expect(screen.getByRole('tooltip')).toHaveTextContent('Player A: 0.300');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Player B: 0.240');
  });

  it('uses two-decimal tooltip formatting for pitching metrics', () => {
    const pitching: PlayersRadarResponse = {
      scope: 'season',
      season: 2025,
      group: 'pitching',
      players: [
        {
          id: 7,
          fullName: 'Pitcher A',
          group: 'pitching',
          stats: { era: 3.456, whip: 1.128, k9: 9.734, bb9: 2.126 },
        },
        {
          id: 8,
          fullName: 'Pitcher B',
          group: 'pitching',
          stats: { era: 2.998, whip: 1.2, k9: 8.61, bb9: 3.405 },
        },
      ],
    };

    render(<PlayerCompareAheadChart data={pitching} group="pitching" />);

    const eraRow = screen.getByText('ERA').closest('.player-ahead-chart__row');
    expect(eraRow).toBeTruthy();
    if (eraRow) {
      fireEvent.mouseEnter(eraRow);
    }

    expect(screen.getByRole('tooltip')).toHaveTextContent('Pitcher A: 3.46');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Pitcher B: 3.00');
  });
});
