import { describe, expect, it } from 'vitest';
import {
  gameInningBarFills,
  gameStatcastHalfTeamFills,
  liftBrandForInningStackedBar,
} from './gameChartColors';

describe('gameInningBarFills', () => {
  const darkSurface = '#16171d';

  it('returns distinct away/home fills for two teams on a dark surface', () => {
    const { awayFill, homeFill } = gameInningBarFills(136, 133, darkSurface);
    expect(awayFill).not.toBe(homeFill);
    expect(awayFill.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
    expect(homeFill.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('lifts very dark primaries to a lighter hex than raw brand on dark surfaces', () => {
    const raw = '#0C2C56';
    const lifted = liftBrandForInningStackedBar(raw, darkSurface);
    expect(lifted.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
    expect(lifted).not.toBe(raw);
  });
});

describe('gameStatcastHalfTeamFills', () => {
  const darkSurface = '#16171d';

  it('matches away/home from gameInningBarFills and provides a neutral other', () => {
    const bars = gameInningBarFills(136, 133, darkSurface);
    const bip = gameStatcastHalfTeamFills(136, 133, darkSurface);
    expect(bip.topHalf).toBe(bars.awayFill);
    expect(bip.bottomHalf).toBe(bars.homeFill);
    expect(bip.other.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
    expect(bip.other).not.toBe(bip.topHalf);
  });
});
