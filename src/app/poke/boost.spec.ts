import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Boost, FOCUS_MULT } from '@poke/boost';
import { Game } from '@poke/game';

describe('Boost (Focus)', () => {
  it('starts idle with no multiplier', () => {
    TestBed.configureTestingModule({});
    const b = TestBed.inject(Boost);
    expect(b.active()).toBe(false);
    expect(b.multiplier()).toBe(1);
    expect(b.secondsLeft()).toBe(0);
  });

  it('activating flips the ×2 multiplier on for the window', () => {
    TestBed.configureTestingModule({});
    const b = TestBed.inject(Boost);
    b.activate(60);
    expect(b.active()).toBe(true);
    expect(b.multiplier()).toBe(FOCUS_MULT);
    expect(b.secondsLeft()).toBeGreaterThan(0);
  });
});

describe('Game integration', () => {
  it('focus boost doubles idle income and passive XP', () => {
    TestBed.configureTestingModule({});
    const game = TestBed.inject(Game);
    const boost = TestBed.inject(Boost);
    const incomeBefore = game.incomePerSec();
    const xpBefore = game.passiveXpPerSec();
    boost.activate(60);
    expect(game.incomePerSec()).toBeCloseTo(incomeBefore * FOCUS_MULT, 5);
    expect(game.passiveXpPerSec()).toBeCloseTo(xpBefore * FOCUS_MULT, 5);
  });

  it('elder shards add +5% income each and never reset', () => {
    TestBed.configureTestingModule({});
    const game = TestBed.inject(Game);
    const before = game.incomePerSec();
    game.grantElder(2);
    expect(game.elder()).toBe(2);
    expect(game.incomePerSec()).toBeCloseTo(before * 1.1, 5);
    // Prestige reset keeps the elder shards.
    game.reset(1);
    expect(game.elder()).toBe(2);
  });
});
