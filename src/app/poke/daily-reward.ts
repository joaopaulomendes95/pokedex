import { computed, inject, signal, Service } from '@angular/core';
import { Game } from '@poke/game';
import { BrowserStorage } from '@core/services/storage';
import { Notify } from '@poke/notify';

const DAILY_KEY = 'poke-league-daily';
/** Streak stops growing past this (reward caps out too). */
export const MAX_STREAK = 14;

interface DailySave {
  lastClaim: string | null;
  streak: number;
}

/** Coin reward for a given streak day. */
export function dailyRewardFor(streak: number): number {
  return Math.min(1500, 50 + (streak - 1) * 25);
}

/** 'YYYY-MM-DD' key for a date (local time). */
export function dateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM-DD' for `days` before/after the given key. */
export function shiftDateKey(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

export interface DailyStatus {
  /** Streak the player would be on after claiming today. */
  streak: number;
  /** Whether today's reward was already claimed. */
  claimed: boolean;
  /** Whether the reward can be claimed right now. */
  available: boolean;
  reward: number;
}

/**
 * Pure daily-streak computation — exported for unit tests.
 * A missed day resets the streak; claiming two days in a row grows it.
 */
export function dailyStatus(lastClaim: string | null, streak: number, today: string): DailyStatus {
  if (lastClaim === today) {
    return { streak, claimed: true, available: false, reward: dailyRewardFor(streak) };
  }
  if (lastClaim !== null && lastClaim === shiftDateKey(today, -1)) {
    const next = Math.min(MAX_STREAK, streak + 1);
    return { streak: next, claimed: false, available: true, reward: dailyRewardFor(next) };
  }
  return { streak: 1, claimed: false, available: true, reward: dailyRewardFor(1) };
}

/**
 * Daily login reward: claim once per day, grow a streak by coming back
 * day after day — the classic "come back tomorrow" hook of idle games.
 */
@Service()
export class DailyReward {
  #_streak = signal(1);
  #_claimed = signal(false);
  #_available = signal(false);
  #_reward = signal(dailyRewardFor(1));
  readonly streak = this.#_streak.asReadonly();
  readonly claimed = this.#_claimed.asReadonly();
  readonly available = this.#_available.asReadonly();
  readonly reward = this.#_reward.asReadonly();

  /** Display line for the hub card. */
  readonly label = computed(() => {
    const base = `Day ${this.#_streak()}`;
    return this.#_claimed() ? `${base} — claimed ✓` : `${base} — claim +${this.#_reward()}¢`;
  });

  #game = inject(Game);
  #storage = inject(BrowserStorage);
  #notify = inject(Notify);

  #lastClaim: string | null = null;

  constructor() {
    this.load();
    this.refresh(new Date());
  }

  /** Recompute availability for the given day (exposed for tests). */
  refresh(today = new Date()): void {
    const status = dailyStatus(this.#lastClaim, this.#_streak(), dateKey(today));
    this.#_streak.set(status.streak);
    this.#_claimed.set(status.claimed);
    this.#_available.set(status.available);
    this.#_reward.set(status.reward);
  }

  /** Claim today's reward (only when available). */
  claim(): boolean {
    if (!this.#_available()) return false;
    this.#game.grantCoins(this.#_reward());
    this.#lastClaim = dateKey(new Date());
    this.persist();
    this.refresh(new Date());
    this.#notify.show(
      `🎁 Daily reward day ${this.#_streak()} — +${this.#_reward()}¢! Come back tomorrow to keep the streak.`,
    );
    return true;
  }

  private load() {
    try {
      const raw = this.#storage.get(DAILY_KEY);
      if (!raw) return;
      const s: DailySave = JSON.parse(raw);
      this.#lastClaim = typeof s.lastClaim === 'string' ? s.lastClaim : null;
      this.#_streak.set(Math.max(1, Math.min(MAX_STREAK, Math.floor(s.streak ?? 1))));
    } catch {
      /* corrupted save — start fresh */
    }
  }

  private persist() {
    try {
      this.#storage.set(
        DAILY_KEY,
        JSON.stringify({ lastClaim: this.#lastClaim, streak: this.#_streak() } satisfies DailySave),
      );
    } catch {
      /* storage blocked — keep in memory */
    }
  }
}
