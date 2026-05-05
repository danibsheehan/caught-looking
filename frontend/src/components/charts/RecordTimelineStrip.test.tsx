import { render, screen } from '@testing-library/react';
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
      screen.getByText(/Select a team and season to see the result strip/i),
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

  it('renders ordered streak transitions and tie legend branch', async () => {
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

    const items = await screen.findAllByRole('listitem');
    expect(items.map((el) => el.textContent)).toEqual(['W', 'W', 'L', 'T']);
    expect(items[0]).toHaveClass('record-timeline__cell--win');
    expect(items[2]).toHaveClass('record-timeline__cell--loss');
    expect(items[3]).toHaveClass('record-timeline__cell--tie');
    expect(items[3]).toHaveAttribute('title', 'Game 4 · 2026-04-04 · T (2-1)');
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
});
