import { describe, expect, it } from 'vitest';
import { gameStatusSettled } from './gameStatus';

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
