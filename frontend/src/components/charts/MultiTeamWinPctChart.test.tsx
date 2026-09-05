import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecordTimelinesBatchResponse } from '../../types/api.compat';
import MultiTeamWinPctChart from './MultiTeamWinPctChart';

const asyncWait = { timeout: 10_000 };

function seriesPoints(
  results: ('W' | 'L')[],
): RecordTimelinesBatchResponse['timelines'][number]['points'] {
  let wins = 0;
  let losses = 0;
  return results.map((result, i) => {
    if (result === 'W') wins += 1;
    else losses += 1;
    return {
      gameIndex: i + 1,
      officialDate: `2026-04-${String(i + 1).padStart(2, '0')}`,
      result,
      wins,
      losses,
      pct: wins / (wins + losses),
    };
  });
}

const batchPayload: RecordTimelinesBatchResponse = {
  season: 2026,
  timelines: [
    {
      teamId: 121,
      season: 2026,
      finishedGames: 5,
      points: seriesPoints(['W', 'W', 'L', 'W', 'W']),
    },
    {
      teamId: 144,
      season: 2026,
      finishedGames: 5,
      points: seriesPoints(['L', 'L', 'W', 'L', 'L']),
    },
  ],
};

const api = vi.hoisted(() => ({
  fetchRecordTimelinesBatch: vi.fn(() => Promise.resolve(batchPayload)),
}));

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/client')>();
  return {
    ...actual,
    fetchRecordTimelinesBatch: api.fetchRecordTimelinesBatch,
  };
});

function getLabel(id: number) {
  if (id === 121) return 'NYM';
  if (id === 144) return 'ATL';
  return String(id);
}

describe('MultiTeamWinPctChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchRecordTimelinesBatch.mockReset();
    api.fetchRecordTimelinesBatch.mockResolvedValue(batchPayload);
  });

  it('prompts when there is no season or no teams', () => {
    const { rerender } = render(
      <MultiTeamWinPctChart teamIds={[121]} season={null} getLabel={getLabel} />,
    );
    expect(
      screen.getByText(/Select a division with teams to compare win percentage curves/i),
    ).toBeInTheDocument();

    rerender(<MultiTeamWinPctChart teamIds={[]} season={2026} getLabel={getLabel} />);
    expect(
      screen.getByText(/Select a division with teams to compare win percentage curves/i),
    ).toBeInTheDocument();
  });

  it('shows empty sample copy when timelines have no points', async () => {
    api.fetchRecordTimelinesBatch.mockResolvedValue({
      season: 2026,
      timelines: [
        { teamId: 121, season: 2026, points: [], finishedGames: 0 },
        { teamId: 144, season: 2026, points: [], finishedGames: 0 },
      ],
    });

    render(<MultiTeamWinPctChart teamIds={[121, 144]} season={2026} getLabel={getLabel} />);

    expect(
      await screen.findByText(/No completed games in this sample yet/i, undefined, asyncWait),
    ).toBeInTheDocument();
  });

  it('fetches batch timelines and renders axis label plus legend entries', async () => {
    api.fetchRecordTimelinesBatch.mockResolvedValue(batchPayload);

    render(<MultiTeamWinPctChart teamIds={[121, 144]} season={2026} getLabel={getLabel} />);

    await waitFor(
      () =>
        expect(api.fetchRecordTimelinesBatch).toHaveBeenCalledWith(
          {
            teamIds: [121, 144],
            season: 2026,
          },
          expect.any(AbortSignal),
        ),
      asyncWait,
    );

    expect(await screen.findByText('Game #', undefined, asyncWait)).toBeInTheDocument();

    await waitFor(() => {
      const legendItems = document.querySelectorAll('.recharts-legend-item-text');
      const legendText = [...legendItems].map((el) => el.textContent?.trim()).filter(Boolean);
      expect(legendText).toEqual(expect.arrayContaining(['NYM', 'ATL']));
    }, asyncWait);
  });

  it('toggles Season, Race, and Recent modes', async () => {
    const user = userEvent.setup();
    render(<MultiTeamWinPctChart teamIds={[121, 144]} season={2026} getLabel={getLabel} />);

    expect(await screen.findByText(/Cumulative win %/i, undefined, asyncWait)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Race' }));
    expect(screen.getByRole('button', { name: 'Race' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/last 40 games on the axis/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Recent' }));
    expect(screen.getByRole('button', { name: 'Recent' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/L10 win %/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Season' }));
    expect(screen.getByRole('button', { name: 'Season' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Full season cumulative win %/i)).toBeInTheDocument();
  });

  it('surfaces fetch errors', { timeout: 15_000 }, async () => {
    api.fetchRecordTimelinesBatch.mockReset();
    api.fetchRecordTimelinesBatch.mockRejectedValue(new Error('network down'));

    render(<MultiTeamWinPctChart teamIds={[121]} season={2026} getLabel={getLabel} />);

    expect(await screen.findByText(/network down/i, undefined, asyncWait)).toBeInTheDocument();
  });
});
