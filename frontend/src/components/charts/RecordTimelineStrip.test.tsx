import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { RecordTimelineResponse } from '../../types/api.compat';
import RecordTimelineStrip from './RecordTimelineStrip';

const api = vi.hoisted(() => ({
  fetchRecordTimeline: vi.fn(),
}));

vi.mock('../../api/client', () => ({
  fetchRecordTimeline: api.fetchRecordTimeline,
}));

function record(points: RecordTimelineResponse['points']): RecordTimelineResponse {
  return { teamId: 121, season: 2026, points, finishedGames: points.length };
}

describe('RecordTimelineStrip', () => {
  it('shows selection prompt for null/undefined values', () => {
    render(<RecordTimelineStrip teamId={null} season={undefined} />);
    expect(
      screen.getByText(/Select a team and season to see the results calendar/i),
    ).toBeInTheDocument();
  });

  it('renders no-games message when timeline is empty', async () => {
    api.fetchRecordTimeline.mockResolvedValueOnce(record([]));
    render(<RecordTimelineStrip teamId={121} season={2026} />);
    expect(await screen.findByText(/No completed games in this sample yet/i)).toBeInTheDocument();
  });

  it('shows API error state', async () => {
    api.fetchRecordTimeline.mockRejectedValueOnce(new Error('record strip failed'));
    render(<RecordTimelineStrip teamId={121} season={2026} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('record strip failed');
  });

  it('renders a month calendar with W/L/T cells and tie legend', async () => {
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
          result: 'L',
          wins: 2,
          losses: 1,
          pct: 0.667,
        },
        {
          gameIndex: 4,
          officialDate: '2026-04-04',
          result: 'T',
          wins: 2,
          losses: 1,
          pct: 0.667,
        },
      ]),
    );
    render(<RecordTimelineStrip teamId={121} season={2026} />);

    expect(
      await screen.findByRole('list', { name: /Game results for April 2026/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'April 2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveClass('record-calendar__day--win');
    expect(items[2]).toHaveClass('record-calendar__day--loss');
    expect(items[3]).toHaveClass('record-calendar__day--tie');
    expect(items[3]).toHaveAttribute('title', 'Game 4 · 2026-04-04 · T (2-1)');
    expect(within(items[0]).getByText('1')).toBeInTheDocument();
    expect(within(items[0]).getByText('W')).toBeInTheDocument();
    expect(screen.getByText(/tie/i)).toBeInTheDocument();
  });

  it('does not show tie legend when no ties are present', async () => {
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
          result: 'L',
          wins: 1,
          losses: 1,
          pct: 0.5,
        },
      ]),
    );
    render(<RecordTimelineStrip teamId={121} season={2026} />);
    expect(await screen.findByRole('list')).toBeInTheDocument();
    expect(screen.queryByText(/tie/i)).not.toBeInTheDocument();
  });

  it('pages between months and defaults to the latest month', async () => {
    const user = userEvent.setup();
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
          officialDate: '2026-05-02',
          result: 'L',
          wins: 1,
          losses: 1,
          pct: 0.5,
        },
      ]),
    );
    render(<RecordTimelineStrip teamId={121} season={2026} />);

    expect(await screen.findByRole('heading', { name: 'May 2026' })).toBeInTheDocument();
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Previous month' }));

    expect(screen.getByRole('heading', { name: 'April 2026' })).toBeInTheDocument();
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeEnabled();
    expect(screen.queryByRole('heading', { name: 'May 2026' })).not.toBeInTheDocument();
  });
});
