import { render, screen } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PlayersRadarResponse } from '../../types/api.compat';
import PlayerRadar from './PlayerRadar';

vi.mock('recharts', () => {
  const Box = ({ children }: PropsWithChildren<Record<string, unknown>>) => <div>{children}</div>;
  return {
    ResponsiveContainer: ({ children }: PropsWithChildren) => <div>{children}</div>,
    RadarChart: Box,
    PolarGrid: Box,
    PolarAngleAxis: Box,
    PolarRadiusAxis: Box,
    Radar: Box,
    Legend: Box,
    Tooltip: Box,
  };
});

const payload: PlayersRadarResponse = {
  scope: 'season',
  season: 2024,
  group: 'hitting',
  players: [
    { id: 1, fullName: 'Alpha', group: 'hitting', stats: { avg: 0.3, ops: 0.9 } },
    { id: 2, fullName: 'Beta', group: 'hitting', stats: { avg: 0.25, ops: 0.8 } },
  ],
};

describe('PlayerRadar', () => {
  it('renders a visually-hidden metric table for assistive tech', () => {
    render(<PlayerRadar ready data={payload} loading={false} error={null} group="hitting" />);
    expect(
      screen.getByRole('table', { name: /Player comparison radar for Alpha and Beta/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '0.300' })).toBeInTheDocument();
  });
});
