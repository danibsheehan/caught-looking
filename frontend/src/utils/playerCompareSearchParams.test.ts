import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAYER_COMPARE_URL,
  buildPlayerCompareSearchParams,
  parsePlayerCompareSearchParams,
} from './playerCompareSearchParams';

describe('parsePlayerCompareSearchParams', () => {
  it('returns defaults for empty params', () => {
    expect(parsePlayerCompareSearchParams(new URLSearchParams())).toEqual(
      DEFAULT_PLAYER_COMPARE_URL,
    );
  });

  it('parses ids, scope, group, season, and metric', () => {
    const sp = new URLSearchParams(
      'ids=1,2&scope=career&group=pitching&season=2024&metric=era&n1=A&n2=B',
    );
    expect(parsePlayerCompareSearchParams(sp)).toEqual({
      id1: 1,
      id2: 2,
      name1: 'A',
      name2: 'B',
      season: 2024,
      scope: 'career',
      group: 'pitching',
      metric: 'era',
    });
  });

  it('rejects duplicate or invalid ids and keeps defaults', () => {
    const sp = new URLSearchParams('ids=5,5');
    expect(parsePlayerCompareSearchParams(sp).id1).toBe(DEFAULT_PLAYER_COMPARE_URL.id1);
    expect(parsePlayerCompareSearchParams(new URLSearchParams('ids=abc')).id1).toBe(
      DEFAULT_PLAYER_COMPARE_URL.id1,
    );
  });

  it('coerces metric to a valid value for the group', () => {
    const sp = new URLSearchParams('ids=1,2&group=hitting&metric=era');
    expect(parsePlayerCompareSearchParams(sp).metric).toBe('ops');
  });
});

describe('buildPlayerCompareSearchParams', () => {
  it('round-trips through parse', () => {
    const built = buildPlayerCompareSearchParams(DEFAULT_PLAYER_COMPARE_URL);
    expect(parsePlayerCompareSearchParams(built)).toEqual(DEFAULT_PLAYER_COMPARE_URL);
  });
});
