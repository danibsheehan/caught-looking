import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DivisionRunsScatter from './DivisionRunsScatter';

describe('DivisionRunsScatter', () => {
  it('shows empty copy when there are no run totals', () => {
    render(<DivisionRunsScatter points={[]} />);
    expect(
      screen.getByText(/Run totals for this division are not available yet/i),
    ).toBeInTheDocument();
  });

  it('renders axis labels when points are present', () => {
    render(
      <DivisionRunsScatter
        points={[
          { teamId: 121, rs: 400, ra: 350, label: 'NYM' },
          { teamId: 144, rs: 380, ra: 360, label: 'ATL' },
        ]}
        focusTeamId={121}
      />,
    );
    expect(screen.getByText('Runs allowed (season)')).toBeInTheDocument();
    expect(screen.getByText('Runs scored (season)')).toBeInTheDocument();
  });
});
