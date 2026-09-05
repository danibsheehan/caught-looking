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

  it('shows the idle placeholder when not ready', () => {
    render(<PlayerRadar ready={false} data={null} loading={false} error={null} />);
    expect(
      screen.getByText(/Enter two different MLB player IDs and a season to compare/i),
    ).toBeInTheDocument();
  });

  it('shows a loading skeleton while fetching with no prior data', () => {
    render(<PlayerRadar ready data={null} loading error={null} />);
    expect(screen.getByRole('status', { name: 'Loading player comparison' })).toBeInTheDocument();
  });

  it('shows an error message when the request fails', () => {
    render(<PlayerRadar ready data={null} loading={false} error={new Error('boom')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
  });

  it('shows an empty state when there are no comparable stat rows', () => {
    const empty: PlayersRadarResponse = { ...payload, players: [] };
    render(<PlayerRadar ready data={empty} loading={false} error={null} />);
    expect(
      screen.getByText(/Not enough stat rows for a radar \(empty season\?\)/i),
    ).toBeInTheDocument();
  });
});
