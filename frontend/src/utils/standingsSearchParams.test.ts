import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STANDINGS_URL,
  buildStandingsSearchParams,
  parseStandingsSearchParams,
  standingsSearchParamsNormalized,
} from './standingsSearchParams';

describe('parseStandingsSearchParams', () => {
  it('defaults to empty team and division', () => {
    expect(parseStandingsSearchParams(new URLSearchParams())).toEqual(DEFAULT_STANDINGS_URL);
  });

  it('parses team and ignores division when team is set', () => {
    const sp = new URLSearchParams('team=121&division=202');
    expect(parseStandingsSearchParams(sp)).toEqual({ teamId: 121, divisionId: '' });
  });

  it('parses division when team is absent', () => {
    expect(parseStandingsSearchParams(new URLSearchParams('division=201'))).toEqual({
      teamId: '',
      divisionId: 201,
    });
  });

  it('rejects non-positive or non-integer ids', () => {
    expect(parseStandingsSearchParams(new URLSearchParams('team=abc'))).toEqual(
      DEFAULT_STANDINGS_URL,
    );
    expect(parseStandingsSearchParams(new URLSearchParams('team=0'))).toEqual(
      DEFAULT_STANDINGS_URL,
    );
    expect(parseStandingsSearchParams(new URLSearchParams('division=-1'))).toEqual(
      DEFAULT_STANDINGS_URL,
    );
  });
});

describe('buildStandingsSearchParams', () => {
  it('omits empty filters', () => {
    const sp = buildStandingsSearchParams(DEFAULT_STANDINGS_URL);
    expect(sp.has('team')).toBe(false);
    expect(sp.has('division')).toBe(false);
  });

  it('writes team and clears division', () => {
    const sp = buildStandingsSearchParams(
      { teamId: 121, divisionId: 201 },
      new URLSearchParams('division=201'),
    );
    expect(sp.get('team')).toBe('121');
    expect(sp.has('division')).toBe(false);
  });

  it('writes division when team is empty', () => {
    const sp = buildStandingsSearchParams({ teamId: '', divisionId: 202 });
    expect(sp.has('team')).toBe(false);
    expect(sp.get('division')).toBe('202');
  });
});

describe('standingsSearchParamsNormalized', () => {
  it('is true for empty and fully normalized URLs', () => {
    expect(standingsSearchParamsNormalized(new URLSearchParams())).toBe(true);
    expect(standingsSearchParamsNormalized(new URLSearchParams('team=121'))).toBe(true);
    expect(standingsSearchParamsNormalized(new URLSearchParams('division=201'))).toBe(true);
  });

  it('is false when team is invalid or both team and division are present', () => {
    expect(standingsSearchParamsNormalized(new URLSearchParams('team=abc'))).toBe(false);
    expect(standingsSearchParamsNormalized(new URLSearchParams('team=121&division=201'))).toBe(
      false,
    );
  });
});
