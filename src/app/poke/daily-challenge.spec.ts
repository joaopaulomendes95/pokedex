import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  DailyChallenge,
  dailyChallengeStatus,
  DAILY_CHALLENGE_STAGES,
} from '@poke/daily-challenge';
import { Game } from '@poke/game';

describe('dailyChallengeStatus (pure)', () => {
  it('ladder is 1 → 3 → 5 → 10 wins', () => {
    expect(DAILY_CHALLENGE_STAGES.map((s) => s.fights)).toEqual([1, 3, 5, 10]);
  });

  it('a stage is claimable once today wins reach its threshold (in order)', () => {
    // Stage 0 needs only 1 win — claimable immediately.
    expect(dailyChallengeStatus(5, 0, new Set()).claimable).toBe(0);
    // After claiming stage 0, stage 1 needs 3 wins today.
    let s = dailyChallengeStatus(5, 0, new Set([0]));
    expect(s.winsToday).toBe(5);
    expect(s.claimable).toBe(1);
    s = dailyChallengeStatus(2, 0, new Set([0]));
    expect(s.claimable).toBeNull(); // only 2 wins today < 3
  });

  it('stages are sequential and done when all claimed', () => {
    const all = new Set([0, 1, 2, 3]);
    const s = dailyChallengeStatus(10, 0, all);
    expect(s.done).toBe(true);
    expect(s.claimable).toBeNull();
    expect(s.nextStage).toBe(4);
  });

  it('wins before the day started do not count', () => {
    const s = dailyChallengeStatus(50, 45, new Set());
    expect(s.winsToday).toBe(5);
    expect(s.claimable).toBe(0); // 5 >= 1
  });
});

describe('DailyChallenge service', () => {
  it('boots a fresh day and claims the first stage at one win', () => {
    TestBed.configureTestingModule({});
    const game = TestBed.inject(Game);
    const dc = TestBed.inject(DailyChallenge);

    expect(dc.status().winsToday).toBe(0);
    expect(dc.status().claimable).toBeNull();

    game.award('player'); // one win
    expect(dc.status().winsToday).toBe(1);
    expect(dc.status().claimable).toBe(0);

    const before = game.coins();
    expect(dc.claim()).toBe(true);
    expect(game.coins()).toBe(before + 50);
    expect(dc.claimed().has(0)).toBe(true);
    expect(dc.claim()).toBe(false); // can't double claim
  });

  it('losing a battle does not reset progress', () => {
    TestBed.configureTestingModule({});
    const game = TestBed.inject(Game);
    const dc = TestBed.inject(DailyChallenge);
    game.award('player');
    game.award('rival'); // a loss — winsToday unchanged
    expect(dc.status().winsToday).toBe(1);
  });
});
