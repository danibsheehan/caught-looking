import { describe, expect, it } from 'vitest';
import type { LeaderRow } from '../types/api.compat';
import { buildLeadersBarData, parseLeaderValue, shortPlayerLabel } from './leadersBarData';

const sample: LeaderRow[] = [
  {
    rank: 1,
    value: '60',
    playerId: 1,
    playerName: 'Cal Raleigh',
    teamId: 136,
    teamName: 'Seattle Mariners',
    leagueName: 'AL',
  },
  {
    rank: 2,
    value: '55',
    playerId: 2,
    playerName: 'Aaron Judge',
    teamId: 147,
    teamName: 'New York Yankees',
    leagueName: 'AL',
  },
];

describe('parseLeaderValue', () => {
  it('parses integers, decimals, and leading-dot averages', () => {
    expect(parseLeaderValue('60')).toBe(60);
    expect(parseLeaderValue('1.97')).toBeCloseTo(1.97);
    expect(parseLeaderValue('.312')).toBeCloseTo(0.312);
    expect(parseLeaderValue('nope')).toBe(0);
  });
});

describe('shortPlayerLabel', () => {
  it('uses the family name and skips generational suffixes', () => {
    expect(shortPlayerLabel('Cal Raleigh')).toBe('Raleigh');
    expect(shortPlayerLabel('Ken Griffey Jr.')).toBe('Griffey');
    expect(shortPlayerLabel('Ronald Acuña Jr.')).toBe('Acuña');
    expect(shortPlayerLabel('Vladimir Guerrero Jr')).toBe('Guerrero');
    expect(shortPlayerLabel('John Doe III')).toBe('Doe');
    expect(shortPlayerLabel('Madonna')).toBe('Madonna');
  });
});

describe('buildLeadersBarData', () => {
  it('maps leaders to chart rows with short labels', () => {
    const rows = buildLeadersBarData(sample);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      rank: 1,
      label: 'Raleigh',
      fullName: 'Cal Raleigh',
      value: 60,
      valueLabel: '60',
    });
    expect(rows[1]?.label).toBe('Judge');
  });

  it('labels suffix names with the family name', () => {
    const rows = buildLeadersBarData([
      {
        rank: 1,
        value: '40',
        playerId: 3,
        playerName: 'Ken Griffey Jr.',
        teamId: 136,
        teamName: 'Seattle Mariners',
      },
    ]);
    expect(rows[0]?.label).toBe('Griffey');
  });
});
