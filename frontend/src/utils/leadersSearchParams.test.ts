import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LEADERS_URL,
  buildLeadersSearchParams,
  parseLeadersSearchParams,
} from './leadersSearchParams';

describe('parseLeadersSearchParams', () => {
  it('defaults to hitting home runs with no season', () => {
    expect(parseLeadersSearchParams(new URLSearchParams())).toEqual(DEFAULT_LEADERS_URL);
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
});

describe('buildLeadersSearchParams', () => {
  it('omits season when undefined', () => {
    const sp = buildLeadersSearchParams(DEFAULT_LEADERS_URL);
    expect(sp.get('group')).toBe('hitting');
    expect(sp.get('category')).toBe('homeRuns');
    expect(sp.has('season')).toBe(false);
  });
});
