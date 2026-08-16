import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  Mastery,
  masteryLevel,
  masteryXpToReach,
  masteryXpMultiplier,
  MASTERY_MAX_LEVEL,
} from '@poke/mastery';
import { Game } from '@poke/game';

describe('mastery math (pure)', () => {
  it('follows the triangular threshold curve', () => {
    expect(masteryXpToReach(1)).toBe(50);
    expect(masteryXpToReach(2)).toBe(150);
    expect(masteryXpToReach(3)).toBe(300);
    expect(masteryLevel(0)).toBe(0);
    expect(masteryLevel(49)).toBe(0);
    expect(masteryLevel(50)).toBe(1);
    expect(masteryLevel(200)).toBe(2);
  });

  it('caps at MASTERY_MAX_LEVEL', () => {
    expect(masteryLevel(1_000_000)).toBe(MASTERY_MAX_LEVEL);
  });

  it('bonus scales linearly with level', () => {
    expect(masteryXpMultiplier(0)).toBe(1);
    expect(masteryXpMultiplier(2)).toBe(1.06);
  });
});

describe('Mastery service', () => {
  it('feeds species XP and boosts grantXp in Game', () => {
    TestBed.configureTestingModule({});
    const game = TestBed.inject(Game);
    const mastery = TestBed.inject(Mastery);

    expect(mastery.level('bulbasaur')).toBe(0);
    game.grantXp('bulbasaur', 400); // feeds 60 mastery XP → level 1 (threshold 50)
    expect(mastery.level('bulbasaur')).toBe(1);
    expect(mastery.totalXp('bulbasaur')).toBe(60);
  });

  it('grantXp pays scaled XP once mastered', () => {
    TestBed.configureTestingModule({});
    const game = TestBed.inject(Game);
    const mastery = TestBed.inject(Mastery);
    // Level 1 mastery = +3% XP.
    mastery.addXp('bulbasaur', 60);
    expect(mastery.level('bulbasaur')).toBe(1);
    game.grantXp('bulbasaur', 100);
    const owned = game.own('bulbasaur')!;
    expect(owned.xp).toBeGreaterThanOrEqual(103);
    // Mastery was fed again (100 * 0.15 = 15 more).
    expect(mastery.totalXp('bulbasaur')).toBe(75);
  });

  it('progress reports level, in-level XP and pct', () => {
    TestBed.configureTestingModule({});
    const mastery = TestBed.inject(Mastery);
    mastery.addXp('charmander', 50);
    const p = mastery.progress('charmander');
    expect(p.level).toBe(1);
    expect(p.xpInLevel).toBe(0);
    expect(p.xpToNext).toBe(100); // 150 to reach L2 minus the 50 already spent
    expect(p.pct).toBe(0);
  });

  it('exposes the top mastered species', () => {
    TestBed.configureTestingModule({});
    const mastery = TestBed.inject(Mastery);
    mastery.addXp('bulbasaur', 200);
    mastery.addXp('charmander', 100);
    const top = mastery.top();
    expect(top[0]!.name).toBe('bulbasaur');
    expect(top.length).toBe(2);
  });
});
