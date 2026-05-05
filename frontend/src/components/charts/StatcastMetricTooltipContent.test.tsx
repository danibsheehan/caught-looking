import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { StatcastChartTooltipRow } from '../../utils/statcastDisplay';
import StatcastMetricTooltipContent from './StatcastMetricTooltipContent';

const fullRows: StatcastChartTooltipRow[] = [
  { variant: 'title', text: 'J. Smith' },
  { variant: 'step', step: 1, title: 'Distance', body: '380 ft' },
  { variant: 'step', step: 2, title: 'Velocity', body: '95.0 mph' },
  { variant: 'step', step: 3, title: 'Angle', body: '12°' },
  { variant: 'step', step: 4, title: 'Result', body: 'Home run' },
];

describe('StatcastMetricTooltipContent', () => {
  it('renders title and ordered metric rows', () => {
    const { container } = render(<StatcastMetricTooltipContent rows={fullRows} />);

    expect(screen.getByText('J. Smith')).toHaveClass('statcast-metric-tooltip__title');

    const list = screen.getByRole('list');
    expect(list).toHaveClass('statcast-metric-tooltip__list');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(4);

    expect(within(items[0]!).getByText('Distance')).toBeInTheDocument();
    expect(within(items[0]!).getByText('380 ft')).toBeInTheDocument();
    expect(within(items[3]!).getByText('Result')).toBeInTheDocument();
    expect(within(items[3]!).getByText('Home run')).toBeInTheDocument();

    expect(container.querySelectorAll('.statcast-metric-tooltip__label')).toHaveLength(4);
    expect(container.querySelectorAll('.statcast-metric-tooltip__value')).toHaveLength(4);
  });

  it('renders title only when there are no step rows', () => {
    const rows: StatcastChartTooltipRow[] = [{ variant: 'title', text: 'Slider' }];
    render(<StatcastMetricTooltipContent rows={rows} />);

    expect(screen.getByText('Slider')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('renders steps without title when title row is absent', () => {
    const rows: StatcastChartTooltipRow[] = [
      { variant: 'step', step: 1, title: 'Velocity', body: '88.2 mph' },
    ];
    render(<StatcastMetricTooltipContent rows={rows} />);

    expect(document.querySelector('.statcast-metric-tooltip__title')).toBeNull();
    const list = screen.getByRole('list');
    expect(within(list).getByText('Velocity')).toBeInTheDocument();
    expect(within(list).getByText('88.2 mph')).toBeInTheDocument();
  });

  it('renders nothing for empty rows', () => {
    const { container } = render(<StatcastMetricTooltipContent rows={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
