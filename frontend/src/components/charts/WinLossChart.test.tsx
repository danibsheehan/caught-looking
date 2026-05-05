import { render, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { RecordTimelineResponse } from '../../types/api.compat';
import WinLossChart from './WinLossChart';

const api = vi.hoisted(() => ({
  fetchRecordTimeline: vi.fn(),
}));

vi.mock('../../api/client', () => ({
  fetchRecordTimeline: api.fetchRecordTimeline,
}));

vi.mock('recharts', () => {
  const Box = ({ children }: PropsWithChildren<Record<string, unknown>>) => <div>{children}</div>;
  return {
    ResponsiveContainer: ({ children }: PropsWithChildren) => (
      <div data-testid="responsive">{children}</div>
    ),
    LineChart: ({ children, data }: PropsWithChildren<{ data?: unknown[] }>) => (
      <div data-testid="line-chart" data-points={data?.length ?? 0}>
        {children}
      </div>
    ),
    CartesianGrid: Box,
    XAxis: Box,
    YAxis: Box,
    Tooltip: Box,
    Line: Box,
    ReferenceDot: ({ x, y }: { x: number; y: number }) => (
      <div data-testid="reference-dot" data-x={x} data-y={y} />
    ),
  };
});

function record(points: RecordTimelineResponse['points']): RecordTimelineResponse {
  return { teamId: 121, season: 2026, points, finishedGames: points.length };
}

describe('WinLossChart', () => {
  it('shows selection prompt for null/undefined inputs', () => {
    render(<WinLossChart teamId={null} season={undefined} />);
    expect(
      screen.getByText(/Select a team and season to plot rolling win percentage/i),
    ).toBeInTheDocument();
  });

  it('renders no-games message for an empty dataset', async () => {
    api.fetchRecordTimeline.mockResolvedValueOnce(record([]));
    render(<WinLossChart teamId={121} season={2026} />);

    expect(await screen.findByText(/No completed games in this sample yet/i)).toBeInTheDocument();
  });

  it('shows API errors', async () => {
    api.fetchRecordTimeline.mockRejectedValueOnce(new Error('timeline failed'));
    render(<WinLossChart teamId={121} season={2026} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('timeline failed');
  });

  it('uses the latest tied peak for short datasets', async () => {
    api.fetchRecordTimeline.mockResolvedValueOnce(
      record([
        {
          gameIndex: 1,
          officialDate: '2026-04-01',
          result: 'W',
          wins: 1,
          losses: 0,
          pct: 1,
        },
        {
          gameIndex: 2,
          officialDate: '2026-04-02',
          result: 'W',
          wins: 2,
          losses: 0,
          pct: 1,
        },
        {
          gameIndex: 3,
          officialDate: '2026-04-03',
          result: 'W',
          wins: 2,
          losses: 1,
          pct: 0.667,
        },
        {
          gameIndex: 4,
          officialDate: '2026-04-04',
          result: 'L',
          wins: 2,
          losses: 2,
          pct: 0.5,
        },
        {
          gameIndex: 5,
          officialDate: '2026-04-05',
          result: 'L',
          wins: 3,
          losses: 2,
          pct: 0.6,
        },
        {
          gameIndex: 6,
          officialDate: '2026-04-06',
          result: 'W',
          wins: 4,
          losses: 2,
          pct: 0.667,
        },
      ]),
    );

    render(<WinLossChart teamId={121} season={2026} />);

    await waitFor(() => expect(screen.getByTestId('line-chart')).toBeInTheDocument());
    expect(screen.getByTestId('line-chart')).toHaveAttribute('data-points', '6');
    // 1 and 2 are tied at the peak; reducer chooses latest tied peak because of >=.
    expect(screen.getByTestId('reference-dot')).toHaveAttribute('data-x', '2');
  });
});
