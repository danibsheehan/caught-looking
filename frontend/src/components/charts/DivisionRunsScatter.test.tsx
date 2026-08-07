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
    const { container } = render(
      <DivisionRunsScatter
        points={[
          { teamId: 121, rs: 400, ra: 350, label: 'NYM' },
          { teamId: 144, rs: 380, ra: 360, label: 'ATL' },
        ]}
        focusTeamId={121}
      />,
    );
    expect(container.querySelector('.chart-frame')).toBeInTheDocument();
    expect(screen.getByText('Runs allowed (season)')).toBeInTheDocument();
    expect(screen.getByText('Runs scored (season)')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: /Division runs scored vs runs allowed/i });
    expect(table).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'NYM' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '400' })).toBeInTheDocument();
  });
});
