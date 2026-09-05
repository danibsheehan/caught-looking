import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayersRadarResponse } from '../types/api.compat';
import { DEFAULT_PLAYER_COMPARE_URL } from '../utils/playerCompareSearchParams';
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

  it('rewrites invalid ids in the URL to the default matchup', async () => {
    const router = createMemoryRouter([{ path: '/players', element: <PlayerComparison /> }], {
      initialEntries: ['/players?ids=5,5&season=2024'],
    });
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      const ids = new URLSearchParams(router.state.location.search).get('ids');
      expect(ids).toBe(`${DEFAULT_PLAYER_COMPARE_URL.id1},${DEFAULT_PLAYER_COMPARE_URL.id2}`);
    }, asyncWait);
  });

  it('lets Change clear a picker so search UI appears', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/players?ids=1,2&season=2024&n1=Alpha%20One&n2=Beta%20Two']}>
        <PlayerComparison />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Alpha One', {}, asyncWait)).toBeInTheDocument();
    const changeButtons = screen.getAllByRole('button', { name: 'Change' });
    expect(changeButtons).toHaveLength(2);

    await user.click(changeButtons[0]!);

    expect(await screen.findByRole('searchbox', {}, asyncWait)).toBeInTheDocument();
    expect(screen.queryByText('Alpha One')).not.toBeInTheDocument();
    expect(screen.getByText('Beta Two')).toBeInTheDocument();
  });

  it('swaps sides when picking a player who is already the other side', async () => {
    const user = userEvent.setup();
    api.fetchPlayersSearch.mockResolvedValue({
      query: 'Beta',
      people: [{ id: 2, fullName: 'Beta Two', active: true }],
    });
    const router = createMemoryRouter([{ path: '/players', element: <PlayerComparison /> }], {
      initialEntries: ['/players?ids=1,2&season=2024&n1=Alpha%20One&n2=Beta%20Two'],
    });
    render(<RouterProvider router={router} />);

    await screen.findByText('Alpha One', {}, asyncWait);
    const changeButtons = screen.getAllByRole('button', { name: 'Change' });
    await user.click(changeButtons[0]!);

    const searchbox = await screen.findByRole('searchbox', {}, asyncWait);
    await user.type(searchbox, 'Beta');
    const hit = await screen.findByRole('button', { name: /Beta Two/i }, asyncWait);
    await user.click(hit);

    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get('ids')).toBe('2,1');
    }, asyncWait);
  });

  it('updates stat group and career metric from the filter controls', async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter([{ path: '/players', element: <PlayerComparison /> }], {
      initialEntries: ['/players?ids=1,2&season=2024&group=hitting&scope=career'],
    });
    render(<RouterProvider router={router} />);
    await screen.findByRole('heading', { level: 1, name: 'Player comparison' }, asyncWait);

    const statGroup = screen.getByLabelText('Stat group');
    await user.selectOptions(statGroup, 'pitching');
    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get('group')).toBe('pitching');
      expect(params.get('metric')).toBe('era');
    }, asyncWait);
  });
});
