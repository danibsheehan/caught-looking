import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TeamWinsBarChart from './TeamWinsBarChart';

describe('TeamWinsBarChart', () => {
  it('renders chart frame with win labels for each team row', async () => {
    const { container } = render(
      <TeamWinsBarChart
        data={[
          { abbrev: 'NYM', wins: 10, teamId: 121 },
          { abbrev: 'ATL', wins: 9, teamId: 144 },
        ]}
      />,
    );

    expect(container.querySelector('.chart-frame')).toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelectorAll('.recharts-bar-rectangle').length).toBe(2);
    });
    expect(container.textContent).toMatch(/ATL|NYM/);
  });

  it('still mounts chart chrome with no teams', () => {
    const { container } = render(<TeamWinsBarChart data={[]} />);
    expect(container.querySelector('.chart-frame')).toBeInTheDocument();
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });
});
