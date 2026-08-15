import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  DailyReward,
  dailyStatus,
  dailyRewardFor,
  dateKey,
  shiftDateKey,
  MAX_STREAK,
} from '@poke/daily-reward';
import { Game } from '@poke/game';

describe('dailyStatus (pure)', () => {
  const today = '2026-08-15';
  it('same day is already claimed', () => {
    const s = dailyStatus('2026-08-15', 3, today);
    expect(s.claimed).toBe(true);
    expect(s.available).toBe(false);
    expect(s.streak).toBe(3);
  });

  it('a yesterday claim grows the streak and becomes available', () => {
    const s = dailyStatus('2026-08-14', 3, today);
    expect(s.available).toBe(true);
    expect(s.streak).toBe(4);
    expect(s.reward).toBe(dailyRewardFor(4));
  });

  it('a missed day resets the streak to day 1', () => {
    const s = dailyStatus('2026-08-10', 5, today);
    expect(s.streak).toBe(1);
    expect(s.available).toBe(true);
    expect(s.reward).toBe(dailyRewardFor(1));
  });

  it('a brand-new player starts at day 1', () => {
    const s = dailyStatus(null, 0, today);
    expect(s.streak).toBe(1);
    expect(s.available).toBe(true);
  });

  it('reward grows with the streak and caps at 1500¢', () => {
    expect(dailyRewardFor(1)).toBe(50);
    expect(dailyRewardFor(3)).toBeGreaterThan(dailyRewardFor(1));
    expect(dailyRewardFor(100)).toBe(1500);
    expect(dailyRewardFor(1000)).toBe(dailyRewardFor(100));
  });

  it('the service streak never exceeds MAX_STREAK', () => {
    // A player who kept their streak far past the cap stays at the cap.
    const s = dailyStatus('2026-08-14', MAX_STREAK, '2026-08-15');
    expect(s.streak).toBe(MAX_STREAK);
  });
});

describe('date helpers', () => {
  it('keys a date and shifts it', () => {
    expect(dateKey(new Date(2026, 7, 15))).toBe('2026-08-15');
    expect(shiftDateKey('2026-08-15', -1)).toBe('2026-08-14');
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28'); // month boundary
  });
});

describe('DailyReward service', () => {
  it('fresh save offers day 1, claim pays coins once', () => {
    TestBed.configureTestingModule({});
    const daily = TestBed.inject(DailyReward);
    const game = TestBed.inject(Game);
    expect(daily.available()).toBe(true);
    expect(daily.streak()).toBe(1);

    const before = game.coins();
    expect(daily.claim()).toBe(true);
    expect(game.coins()).toBe(before + daily.reward());
    expect(daily.claimed()).toBe(true);
    expect(daily.claim()).toBe(false); // no double claim
  });
});
