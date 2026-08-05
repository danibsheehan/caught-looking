import { describe, expect, it } from 'vitest';
import { gameStatusLabel, gameStatusSettled } from './gameStatus';

describe('gameStatusSettled', () => {
  it('treats empty as unsettled', () => {
    expect(gameStatusSettled(undefined)).toBe(false);
    expect(gameStatusSettled('')).toBe(false);
    expect(gameStatusSettled('   ')).toBe(false);
  });

  it('detects settled states', () => {
    expect(gameStatusSettled('Final')).toBe(true);
    expect(gameStatusSettled('Completed Early')).toBe(true);
    expect(gameStatusSettled('Game Over')).toBe(true);
    expect(gameStatusSettled('Postponed')).toBe(true);
    expect(gameStatusSettled('Cancelled')).toBe(true);
    expect(gameStatusSettled('Canceled')).toBe(true);
  });

  it('keeps live/preview unsettled', () => {
    expect(gameStatusSettled('In Progress')).toBe(false);
    expect(gameStatusSettled('Warmup')).toBe(false);
    expect(gameStatusSettled('Pre-Game')).toBe(false);
    expect(gameStatusSettled('Delayed')).toBe(false);
  });
});

describe('gameStatusLabel', () => {
  it('returns trimmed MLB status when present', () => {
    expect(gameStatusLabel(' Final ')).toBe('Final');
    expect(gameStatusLabel('In Progress')).toBe('In Progress');
  });

  it('uses Live when status is missing (matches unsettled polling)', () => {
    expect(gameStatusLabel(undefined)).toBe('Live');
    expect(gameStatusLabel('')).toBe('Live');
    expect(gameStatusLabel('   ')).toBe('Live');
  });
});
