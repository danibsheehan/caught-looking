import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LEADERS_SEASON,
  DEFAULT_LEADERS_URL,
  buildLeadersSearchParams,
  clampLeadersSeason,
  leadersSearchParamsNormalized,
  parseLeadersSearchParams,
} from './leadersSearchParams';

describe('clampLeadersSeason', () => {
  it('keeps in-range integers and falls back otherwise', () => {
    expect(clampLeadersSeason(2024)).toBe(2024);
    expect(clampLeadersSeason(1899)).toBe(DEFAULT_LEADERS_SEASON);
    expect(clampLeadersSeason(2101)).toBe(DEFAULT_LEADERS_SEASON);
    expect(clampLeadersSeason(2024.5)).toBe(DEFAULT_LEADERS_SEASON);
    expect(clampLeadersSeason(Number.NaN)).toBe(DEFAULT_LEADERS_SEASON);
  });
});

describe('parseLeadersSearchParams', () => {
  it('defaults to hitting home runs for the shared default season', () => {
    expect(parseLeadersSearchParams(new URLSearchParams())).toEqual(DEFAULT_LEADERS_URL);
    expect(DEFAULT_LEADERS_URL.season).toBe(DEFAULT_LEADERS_SEASON);
  });

  it('parses pitching category and season', () => {
    const sp = new URLSearchParams('group=pitching&category=wins&season=2025');
    expect(parseLeadersSearchParams(sp)).toEqual({
      group: 'pitching',
      category: 'wins',
      season: 2025,
    });
  });

  it('resets category when invalid for the group', () => {
    const sp = new URLSearchParams('group=hitting&category=wins');
    expect(parseLeadersSearchParams(sp).category).toBe('homeRuns');
  });

  it('falls back to the default season for invalid values', () => {
    expect(parseLeadersSearchParams(new URLSearchParams('season=abc')).season).toBe(
      DEFAULT_LEADERS_SEASON,
    );
    expect(parseLeadersSearchParams(new URLSearchParams('season=2200')).season).toBe(
      DEFAULT_LEADERS_SEASON,
    );
  });
});

describe('buildLeadersSearchParams', () => {
  it('writes group, category, and season', () => {
    const sp = buildLeadersSearchParams(DEFAULT_LEADERS_URL);
    expect(sp.get('group')).toBe('hitting');
    expect(sp.get('category')).toBe('homeRuns');
    expect(sp.get('season')).toBe(String(DEFAULT_LEADERS_SEASON));
  });

  it('clamps out-of-range seasons before writing the query string', () => {
    const sp = buildLeadersSearchParams({
      ...DEFAULT_LEADERS_URL,
      season: 9999,
    });
    expect(sp.get('season')).toBe(String(DEFAULT_LEADERS_SEASON));
  });
});

describe('leadersSearchParamsNormalized', () => {
  it('is false when season is invalid or filters are missing', () => {
    expect(leadersSearchParamsNormalized(new URLSearchParams())).toBe(false);
    expect(leadersSearchParamsNormalized(new URLSearchParams('season=abc'))).toBe(false);
  });

  it('is true for a fully normalized leaders URL', () => {
    const sp = buildLeadersSearchParams(DEFAULT_LEADERS_URL);
    expect(leadersSearchParamsNormalized(sp)).toBe(true);
  });
});
