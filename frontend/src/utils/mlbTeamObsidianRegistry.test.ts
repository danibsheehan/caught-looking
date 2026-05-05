import { describe, expect, it } from 'vitest';
import {
  MLB_TEAM_OBSIDIAN_REGISTRY,
  circularHueDistanceDeg,
  getObsidianTeamColor,
  resolveObsidianMatchupFills,
} from './mlbTeamObsidianRegistry';

describe('hexHueDegrees / circularHueDistanceDeg', () => {
  it('reports ~0° between identical hexes', () => {
    expect(circularHueDistanceDeg('#3a5a8a', '#3a5a8a')).toBeLessThan(1);
  });

  it('reports large separation for red vs blue', () => {
    expect(circularHueDistanceDeg('#c03030', '#2060a0')).toBeGreaterThan(60);
  });
});

describe('resolveObsidianMatchupFills', () => {
  it('returns null when either id is unknown', () => {
    expect(resolveObsidianMatchupFills(147, 999999)).toBeNull();
    expect(resolveObsidianMatchupFills(null, 147)).toBeNull();
  });

  it('uses both primaries when hues are far apart', () => {
    const { awayFill, homeFill } = resolveObsidianMatchupFills(112, 120)!;
    expect(awayFill).toBe(MLB_TEAM_OBSIDIAN_REGISTRY[112].primary);
    expect(homeFill).toBe(MLB_TEAM_OBSIDIAN_REGISTRY[120].primary);
  });

  /** NYY and SEA share the same lifted navy primary in the registry — conflict path. */
  it('gives alphabetically first team primary and the other secondary when hues clash', () => {
    const nyy = MLB_TEAM_OBSIDIAN_REGISTRY[147];
    const sea = MLB_TEAM_OBSIDIAN_REGISTRY[136];
    expect(nyy.primary).toBe(sea.primary);

    const nyHome = resolveObsidianMatchupFills(136, 147)!;
    expect(nyHome.awayFill).toBe(sea.secondary);
    expect(nyHome.homeFill).toBe(nyy.primary);

    const nyAway = resolveObsidianMatchupFills(147, 136)!;
    expect(nyAway.awayFill).toBe(nyy.primary);
    expect(nyAway.homeFill).toBe(sea.secondary);
  });
});

describe('getObsidianTeamColor', () => {
  it('returns tint mixed toward obsidian bg', () => {
    const c = getObsidianTeamColor(147)!;
    expect(c.tint.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
    expect(c.tint).not.toBe(c.primary);
  });
});
