import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { StatcastBattedBall } from '../../types/api.compat';
import GameStatcastSpray from './GameStatcastSpray';

const ball = (overrides: Partial<StatcastBattedBall>): StatcastBattedBall => ({
  batter: 1,
  pitcher: 2,
  playerName: 'Test Batter',
  hcX: 125,
  hcY: 125,
  events: 'single',
  inningHalf: 'Top',
  launchSpeed: 95,
  launchAngle: 20,
  ...overrides,
});

describe('GameStatcastSpray', () => {
  it('shows an empty state when there are no batted balls with field locations', () => {
    render(<GameStatcastSpray battedBalls={[]} />);
    expect(
      screen.getByText(/No field-location data for this game, so the spray chart cannot be shown/i),
    ).toBeInTheDocument();
  });

  it('drops batted balls missing hcX/hcY before rendering', () => {
    render(<GameStatcastSpray battedBalls={[ball({ hcX: undefined, hcY: undefined })]} />);
    expect(
      screen.getByText(/No field-location data for this game, so the spray chart cannot be shown/i),
    ).toBeInTheDocument();
  });

  it('uses the venue-specific caption when a venue name is provided', () => {
    render(<GameStatcastSpray battedBalls={[ball({})]} venueId={1} venueName="Fenway Park" />);
    expect(
      screen.getByRole('table', {
        name: /Spray chart of batted ball field locations at Fenway Park/i,
      }),
    ).toBeInTheDocument();
    expect(document.querySelector('.game-statcast-spray__caption')?.textContent).toMatch(
      /matches Fenway Park's published left, center, and right/i,
    );
  });

  it('uses the generic caption when no venue name is provided', () => {
    render(<GameStatcastSpray battedBalls={[ball({})]} />);
    expect(
      screen.getByRole('table', { name: /Spray chart of batted ball field locations\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/generic outfield distances \(venue unknown\)/i)).toBeInTheDocument();
  });

  it('lists batted balls with their batting side in the a11y data table', () => {
    render(
      <GameStatcastSpray
        battedBalls={[
          ball({ playerName: 'Away Batter', inningHalf: 'Top' }),
          ball({ playerName: 'Home Batter', inningHalf: 'Bot' }),
        ]}
        awayTeamId={100}
        homeTeamId={200}
      />,
    );
    expect(screen.getByRole('row', { name: /Away Batter/ })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Home Batter/ })).toBeInTheDocument();
  });

  it('shows a tooltip with the batter name on marker hover and hides it on mouse leave', () => {
    const { container } = render(
      <GameStatcastSpray battedBalls={[ball({ playerName: 'Hover Batter' })]} />,
    );
    const circles = container.querySelectorAll('circle');
    const marker = circles[circles.length - 1]!;
    const tooltipQuery = () => container.querySelector('.statcast-metric-tooltip');

    expect(tooltipQuery()).not.toBeInTheDocument();

    fireEvent.mouseEnter(marker);
    expect(tooltipQuery()).toHaveTextContent('Hover Batter');

    fireEvent.mouseLeave(marker);
    expect(tooltipQuery()).not.toBeInTheDocument();
  });
});
