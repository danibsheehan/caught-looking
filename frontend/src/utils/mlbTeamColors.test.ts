import { describe, expect, it } from 'vitest';
import { adjustChartColorForSurface } from './chartColorContrast';
import {
  CHART_NEUTRAL_FALLBACK,
  MLB_TEAM_PRIMARY_HEX,
  distinctChartColorsForTeamIds,
  mlbTeamPrimaryHex,
  obsidianTeamChartPairs,
  obsidianTeamChartPairsRegistryPrimary,
  resolveGameScoreBarFills,
  rgbDistance,
  teamSplitChartColors,
} from './mlbTeamColors';
import { MLB_TEAM_OBSIDIAN_REGISTRY } from './mlbTeamObsidianRegistry';

describe('obsidianTeamChartPairsRegistryPrimary vs distinctness', () => {
  const surface = '#070b10';
  /** AL East–style sample: distinctness swap used to give BOS a non-red “ink”. */
  const alEastLike = [147, 139, 110, 141, 111];

  it('uses registry primary ink so bars match strip (BOS stays red family)', () => {
    const reg = obsidianTeamChartPairsRegistryPrimary(alEastLike, surface);
    const distinct = obsidianTeamChartPairs(alEastLike, surface);
    const bosIdx = 4;
    const bReg = reg[bosIdx]!.ink;
    const bDistinct = distinct[bosIdx]!.ink;
    expect(rgbDistance(bReg, bDistinct)).toBeGreaterThan(15);
    expect(rgbDistance(bReg, '#c03030')).toBeLessThan(rgbDistance(bDistinct, '#c03030'));
  });
});

describe('rgbDistance', () => {
  it('returns Euclidean distance in RGB space', () => {
    expect(rgbDistance('#000000', '#ffffff')).toBeCloseTo(Math.sqrt(255 ** 2 * 3));
  });

  it('returns 255 when either hex is invalid', () => {
    expect(rgbDistance('xx', '#ffffff')).toBe(255);
    expect(rgbDistance('#ffffff', 'bad')).toBe(255);
  });
});

describe('distinctChartColorsForTeamIds', () => {
  it('returns empty array for empty input', () => {
    expect(distinctChartColorsForTeamIds([], '#ffffff')).toEqual([]);
  });

  it('assigns adjusted colors for known teams', () => {
    const colors = distinctChartColorsForTeamIds([108, 109], '#ffffff');
    expect(colors).toHaveLength(2);
    expect(colors[0]).toMatch(/^#/);
    expect(colors[1]).toMatch(/^#/);
    expect(colors[0]).not.toBe(colors[1]);
  });

  it('uses neutral fallback for invalid team id', () => {
    const colors = distinctChartColorsForTeamIds([0], '#ffffff');
    expect(colors).toHaveLength(1);
    expect(colors[0]).toMatch(/^#/);
  });
});

describe('resolveGameScoreBarFills', () => {
  it('uses obsidian registry primaries when hues are distinct', () => {
    const awayId = 112;
    const homeId = 120;
    const pAway = MLB_TEAM_OBSIDIAN_REGISTRY[awayId].primary;
    const pHome = MLB_TEAM_OBSIDIAN_REGISTRY[homeId].primary;
    expect(rgbDistance(pAway, pHome)).toBeGreaterThan(40);

    const { awayFill, homeFill } = resolveGameScoreBarFills(awayId, homeId, '#111', '#222');
    expect(awayFill).toBe(pAway);
    expect(homeFill).toBe(pHome);
  });

  it('uses fallbacks when team ids are missing', () => {
    const { awayFill, homeFill } = resolveGameScoreBarFills(null, undefined, '#aaa', '#bbb');
    expect(awayFill).toBe('#aaa');
    expect(homeFill).toBe('#bbb');
  });

  it('prefers a more separated pair when primaries clash', () => {
    const { awayFill, homeFill } = resolveGameScoreBarFills(108, 108, '#111', '#222');
    expect(awayFill).toBeDefined();
    expect(homeFill).toBeDefined();
    expect(rgbDistance(awayFill, homeFill)).toBeGreaterThan(0);
  });
});

describe('mlbTeamPrimaryHex', () => {
  it('returns mapped primary for known id', () => {
    expect(mlbTeamPrimaryHex(108, '#fallback')).toBe('#BA0021');
  });

  it('returns fallback for unknown or invalid id', () => {
    expect(mlbTeamPrimaryHex(999999, '#z')).toBe('#z');
    expect(mlbTeamPrimaryHex(null, '#z')).toBe('#z');
    expect(mlbTeamPrimaryHex(-1, '#z')).toBe('#z');
  });
});

describe('teamSplitChartColors', () => {
  it('returns offense and defense hex strings for a known team', () => {
    const { offense, defense } = teamSplitChartColors(108, '#ffffff');
    expect(offense).toMatch(/^#/);
    expect(defense).toMatch(/^#/);
    expect(offense).not.toBe(defense);
  });

  it('uses neutrals when team id is invalid', () => {
    const { offense, defense } = teamSplitChartColors(null, '#ffffff');
    expect(offense).toBe(adjustChartColorForSurface(CHART_NEUTRAL_FALLBACK, '#ffffff'));
    expect(defense).toMatch(/^#/);
    expect(defense).not.toBe(offense);
  });
});
