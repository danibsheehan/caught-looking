import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { LeaderRow } from '../../types/api.compat';
import LeadersTop10Bar from './LeadersTop10Bar';

const sample: LeaderRow[] = [
  {
    rank: 1,
    value: '60',
    playerId: 1,
    playerName: 'Cal Raleigh',
    teamId: 136,
    teamName: 'Seattle Mariners',
    leagueName: 'AL',
  },
  {
    rank: 2,
    value: '55',
    playerId: 2,
    playerName: 'Aaron Judge',
    teamId: 147,
    teamName: 'New York Yankees',
    leagueName: 'AL',
  },
];

describe('LeadersTop10Bar', () => {
  it('renders nothing when there are no leaders', () => {
    const { container } = render(<LeadersTop10Bar leaders={[]} categoryLabel="Home runs" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a horizontal chart frame with one bar per leader', async () => {
    const { container } = render(<LeadersTop10Bar leaders={sample} categoryLabel="Home runs" />);
    expect(container.querySelector('.leaders-top10-bar')).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelectorAll('.recharts-bar-rectangle').length).toBe(2);
    });
  });
});
