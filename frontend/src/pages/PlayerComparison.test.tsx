import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayersRadarResponse } from '../types/api.compat';
import PlayerComparison from './PlayerComparison';

const asyncWait = { timeout: 10_000 };

const api = vi.hoisted(() => {
  const compare: PlayersRadarResponse = {
    scope: 'season',
    season: 2024,
    group: 'hitting',
    players: [
      { id: 1, fullName: 'Alpha One', group: 'hitting', stats: { ops: 0.9 } },
      { id: 2, fullName: 'Beta Two', group: 'hitting', stats: { ops: 0.8 } },
    ],
  };
  return {
    compare,
    fetchPlayersCompare: vi.fn(async () => compare),
    fetchPlayersCurrentTeams: vi.fn(async () => ({
      players: [
        { id: 1, fullName: 'Alpha One', currentTeamId: 147, currentTeamName: 'A' },
        { id: 2, fullName: 'Beta Two', currentTeamId: 121, currentTeamName: 'B' },
      ],
    })),
    fetchPlayersCompareYearByYear: vi.fn(async () => ({
      group: 'hitting',
      metric: 'ops',
      players: [],
      league: [],
    })),
    fetchPlayersCompareGameLog: vi.fn(async () => ({
      season: 2024,
      group: 'hitting',
      players: [],
    })),
    fetchPlayersComparePlatoon: vi.fn(async () => ({
      season: 2024,
      group: 'hitting',
      players: [],
    })),
    fetchPlayersSearch: vi.fn(async () => ({ people: [] })),
  };
});

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    fetchPlayersCompare: api.fetchPlayersCompare,
    fetchPlayersCurrentTeams: api.fetchPlayersCurrentTeams,
    fetchPlayersCompareYearByYear: api.fetchPlayersCompareYearByYear,
    fetchPlayersCompareGameLog: api.fetchPlayersCompareGameLog,
    fetchPlayersComparePlatoon: api.fetchPlayersComparePlatoon,
    fetchPlayersSearch: api.fetchPlayersSearch,
  };
});

describe('PlayerComparison deep links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchPlayersCompare.mockResolvedValue(api.compare);
  });

  it('loads the matchup from ids and season query params', async () => {
    render(
      <MemoryRouter initialEntries={['/players?ids=1,2&season=2024&group=hitting&scope=season']}>
        <PlayerComparison />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Player comparison' }, asyncWait),
    ).toBeInTheDocument();

    await waitFor(
      () =>
        expect(api.fetchPlayersCompare).toHaveBeenCalledWith(
          expect.objectContaining({
            ids: '1,2',
            season: 2024,
            group: 'hitting',
            scope: 'season',
          }),
          expect.any(AbortSignal),
        ),
      asyncWait,
    );

    expect(await screen.findByDisplayValue('2024', {}, asyncWait)).toBeInTheDocument();
  });
});
