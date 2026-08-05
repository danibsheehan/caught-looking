import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEAM_OVERVIEW_URL,
  buildTeamOverviewSearchParams,
  parseTeamOverviewSearchParams,
} from './teamOverviewSearchParams';

describe('parseTeamOverviewSearchParams', () => {
  it('defaults with empty team and trend tab', () => {
    expect(parseTeamOverviewSearchParams(new URLSearchParams())).toEqual(DEFAULT_TEAM_OVERVIEW_URL);
  });

  it('parses team, season, and deep tab', () => {
    const sp = new URLSearchParams('team=147&season=2024&tab=deep');
    expect(parseTeamOverviewSearchParams(sp)).toEqual({
      teamId: 147,
      season: 2024,
      tab: 'deep',
    });
  });
});

describe('buildTeamOverviewSearchParams', () => {
  it('omits empty team and default trend tab', () => {
    const sp = buildTeamOverviewSearchParams(DEFAULT_TEAM_OVERVIEW_URL);
    expect(sp.has('team')).toBe(false);
    expect(sp.get('season')).toBe('2026');
    expect(sp.has('tab')).toBe(false);
  });
});
