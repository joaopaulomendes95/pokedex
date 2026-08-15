import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Achievements, ACHIEVEMENTS } from '@poke/achievements';
import { Game } from '@poke/game';

describe('Achievements', () => {
  it('auto-rewards the first-win achievement exactly once', () => {
    TestBed.configureTestingModule({});
    const game = TestBed.inject(Game);
    const ach = TestBed.inject(Achievements);

    const firstWin = ACHIEVEMENTS.find((a) => a.id === 'first-win')!;
    expect(ach.isUnlocked(firstWin)).toBe(false);

    const coinsBefore = game.coins();
    game.award('player');
    TestBed.flushEffects();

    expect(ach.isUnlocked(firstWin)).toBe(true);
    expect(ach.unlockedCount()).toBeGreaterThanOrEqual(1);
    expect(game.coins()).toBe(coinsBefore + 10 + firstWin.reward); // win payout + reward

    // A second win must NOT pay the achievement again.
    const afterUnlock = game.coins();
    game.award('player');
    TestBed.flushEffects();
    expect(game.coins()).toBe(afterUnlock + 10); // win payout only
  });

  it('unlocks the collection achievements as the roster grows', () => {
    TestBed.configureTestingModule({});
    const game = TestBed.inject(Game);
    const ach = TestBed.inject(Achievements);

    const collector = ACHIEVEMENTS.find((a) => a.id === 'collector-30')!;
    for (let i = 0; i < 30; i++) game.add(`species-${i}`, 1);
    TestBed.flushEffects();
    expect(ach.isUnlocked(collector)).toBe(true);
  });

  it('a fresh save unlocks nothing', () => {
    TestBed.configureTestingModule({});
    const ach = TestBed.inject(Achievements);
    expect(ach.unlockedCount()).toBe(0);
  });
});
