import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Upgrades, UPGRADES } from '@poke/upgrades';
import { Game } from '@poke/game';

describe('Upgrades', () => {
  it('starts everything at level 0 with no multipliers', () => {
    TestBed.configureTestingModule({});
    const u = TestBed.inject(Upgrades);
    expect(u.level('income')).toBe(0);
    expect(u.multiplier('income')).toBe(1);
    expect(u.flatBonus('energyCap')).toBe(0);
    expect(UPGRADES.length).toBeGreaterThanOrEqual(6);
  });

  it('leveling raises multipliers and costs grow', () => {
    TestBed.configureTestingModule({});
    const u = TestBed.inject(Upgrades);
    const income = UPGRADES.find((x) => x.id === 'income')!;
    const firstCost = u.cost(income);
    u.levelUp(income);
    expect(u.level('income')).toBe(1);
    expect(u.multiplier('income')).toBe(1.1);
    expect(u.cost(income)).toBeGreaterThan(firstCost);
  });

  it('refuses to level past the max', () => {
    TestBed.configureTestingModule({});
    const u = TestBed.inject(Upgrades);
    const cap = UPGRADES.find((x) => x.id === 'energyCap')!;
    for (let i = 0; i < cap.maxLevel + 3; i++) u.levelUp(cap);
    expect(u.level('energyCap')).toBe(cap.maxLevel);
  });
});

describe('Game + upgrades integration', () => {
  it('income, energy cap and regen reflect bought upgrades', () => {
    TestBed.configureTestingModule({});
    const game = TestBed.inject(Game);
    const u = TestBed.inject(Upgrades);
    const income = UPGRADES.find((x) => x.id === 'income')!;
    const cap = UPGRADES.find((x) => x.id === 'energyCap')!;

    const baseIncome = game.incomePerSec();
    const baseMax = game.energyMax();
    u.levelUp(income);
    u.levelUp(cap);
    expect(game.incomePerSec()).toBeCloseTo(baseIncome * 1.1, 5);
    expect(game.energyMax()).toBe(baseMax + cap.perLevel);
  });

  it('spend + levelUp is the purchase flow (coins drain)', () => {
    TestBed.configureTestingModule({});
    const game = TestBed.inject(Game);
    const u = TestBed.inject(Upgrades);
    const xp = UPGRADES.find((x) => x.id === 'xp')!;
    const cost = u.cost(xp);
    game.grantCoins(cost + 10);
    const before = game.coins();
    expect(game.spend(cost)).toBe(true);
    u.levelUp(xp);
    expect(game.coins()).toBe(before - cost);
    expect(u.level('xp')).toBe(1);
  });
});
