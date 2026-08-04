import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LeadersResponse } from '../types/api.compat';
import Leaders from './Leaders';

const asyncWait = { timeout: 10_000 };

const api = vi.hoisted(() => {
  const hitting: LeadersResponse = {
    season: 2025,
    group: 'hitting',
    category: 'homeRuns',
    limit: 10,
    categories: ['homeRuns', 'battingAverage', 'hits'],
    leaders: [
      {
        rank: 1,
        value: '60',
        playerId: 663728,
        playerName: 'Cal Raleigh',
        teamId: 136,
        teamName: 'Seattle Mariners',
        leagueName: 'AL',
      },
    ],
  };

  const pitching: LeadersResponse = {
    season: 2025,
    group: 'pitching',
    category: 'earnedRunAverage',
    limit: 10,
    categories: ['earnedRunAverage', 'wins', 'strikeouts'],
    leaders: [
      {
        rank: 1,
        value: '1.97',
        playerId: 694973,
        playerName: 'Paul Skenes',
        teamId: 134,
        teamName: 'Pittsburgh Pirates',
        leagueName: 'NL',
      },
    ],
  };

  return {
    hitting,
    pitching,
    fetchLeaders: vi.fn(async (query: { group?: string; category?: string } = {}) => {
      if (query.group === 'pitching') return pitching;
      return hitting;
    }),
  };
});

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    fetchLeaders: api.fetchLeaders,
  };
});

describe('Leaders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads hitting leaders and switches to pitching', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Leaders />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Leaders' }, asyncWait),
    ).toBeInTheDocument();
    expect(await screen.findByText('Cal Raleigh', {}, asyncWait)).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();

    await waitFor(() => expect(api.fetchLeaders).toHaveBeenCalled(), asyncWait);
    expect(api.fetchLeaders).toHaveBeenCalledWith(
      expect.objectContaining({ group: 'hitting', category: 'homeRuns', limit: 10 }),
      expect.any(AbortSignal),
    );

    await user.click(screen.getByRole('tab', { name: 'Pitching' }));
    expect(await screen.findByText('Paul Skenes', {}, asyncWait)).toBeInTheDocument();
    expect(screen.getByText('1.97')).toBeInTheDocument();

    await waitFor(
      () =>
        expect(api.fetchLeaders).toHaveBeenCalledWith(
          expect.objectContaining({
            group: 'pitching',
            category: 'earnedRunAverage',
            limit: 10,
          }),
          expect.any(AbortSignal),
        ),
      asyncWait,
    );
  });

  it('surfaces fetch errors', async () => {
    api.fetchLeaders.mockRejectedValueOnce(new Error('leaders down'));
    render(
      <MemoryRouter>
        <Leaders />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('alert', {}, asyncWait)).toHaveTextContent('leaders down');
  });
});
