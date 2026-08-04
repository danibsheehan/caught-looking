import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ChartDataTable from './ChartDataTable';

describe('ChartDataTable', () => {
  it('renders a captioned table for screen readers', () => {
    render(
      <ChartDataTable
        caption="Runs by inning"
        columns={['Inning', 'Away', 'Home']}
        rows={[
          ['1', '2', '0'],
          ['2', '0', '1'],
        ]}
        footnote="Showing 2 of 9 innings."
      />,
    );

    expect(screen.getByRole('table', { name: 'Runs by inning' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Inning' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /1 2 0/ })).toBeInTheDocument();
    expect(screen.getByText('Showing 2 of 9 innings.')).toBeInTheDocument();
  });

  it('renders nothing when there are no rows', () => {
    const { container } = render(<ChartDataTable caption="Empty" columns={['A']} rows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
