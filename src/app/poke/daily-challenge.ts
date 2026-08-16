import { computed, effect, inject, signal, Service } from '@angular/core';
import { Game } from '@poke/game';
import { BrowserStorage } from '@core/services/storage';
import { Notify } from '@poke/notify';
import { dateKey } from '@poke/daily-reward';
import { Summon, FRAGMENTS_PER_CHALLENGE_STAGE } from '@poke/summon';

const CHALLENGE_KEY = 'poke-league-challenge';

/** The daily challenge ladder: win 1, 3, 5, then 10 battles today. */
export const DAILY_CHALLENGE_STAGES: { fights: number; reward: number }[] = [
  { fights: 1, reward: 50 },
  { fights: 3, reward: 150 },
  { fights: 5, reward: 300 },
  { fights: 10, reward: 750 },
];

interface ChallengeSave {
  day: string;
  winsAtDayStart: number;
  claimed: number[];
}

export interface DailyChallengeStatus {
  /** Wins accumulated since the day started. */
  winsToday: number;
  /** Index of the next stage to complete (0-based). */
  nextStage: number;
  total: number;
  /** Index of a stage that can be claimed right now, or null. */
  claimable: number | null;
  done: boolean;
}

/**
 * Pure daily-challenge status — exported for unit tests.
 * Stage `i` is claimable once today's wins reach its (cumulative) threshold
 * and every earlier stage has been claimed; a new day resets everything.
 */
export function dailyChallengeStatus(
  lifetimeWins: number,
  winsAtDayStart: number,
  claimed: ReadonlySet<number>,
): DailyChallengeStatus {
  const total = DAILY_CHALLENGE_STAGES.length;
  const winsToday = Math.max(0, lifetimeWins - winsAtDayStart);
  let next = 0;
  while (next < total && claimed.has(next)) next++;
  const claimable = next < total && winsToday >= DAILY_CHALLENGE_STAGES[next]!.fights ? next : null;
  return { winsToday, nextStage: next, total, claimable, done: next >= total };
}

/**
 * Daily challenge ladder: every day the player wins 1 → 3 → 5 → 10 battles,
 * claiming a reward at each step. Progress carries across losses (only wins
 * count) and resets when the date changes.
 */
@Service()
export class DailyChallenge {
  #_day = signal('');
  #_winsAtDayStart = signal(0);
  #_claimed = signal<Set<number>>(new Set());
  readonly claimed = this.#_claimed.asReadonly();

  readonly status = computed<DailyChallengeStatus>(() =>
    dailyChallengeStatus(this.#game.stats().wins, this.#_winsAtDayStart(), this.#_claimed()),
  );

  /** The stage currently being worked toward. */
  readonly currentStage = computed(() => {
    const s = this.status();
    return DAILY_CHALLENGE_STAGES[Math.min(s.nextStage, s.total - 1)] ?? DAILY_CHALLENGE_STAGES[0]!;
  });

  #game = inject(Game);
  #storage = inject(BrowserStorage);
  #notify = inject(Notify);
  #summon = inject(Summon);

  constructor() {
    this.load();
    this.refreshDay(new Date());
    // Roll the day over while the app stays open (checked once a minute).
    setInterval(() => this.refreshDay(new Date()), 60_000);
    effect(() => void this.#game.stats());
  }

  /** Reset counters when the date changes (also called on boot). */
  refreshDay(today = new Date()): void {
    const key = dateKey(today);
    if (this.#_day() === key) return;
    this.#_day.set(key);
    this.#_winsAtDayStart.set(this.#game.stats().wins);
    this.#_claimed.set(new Set());
    this.persist();
  }

  /** Claim the currently available stage reward. */
  claim(): boolean {
    const s = this.status();
    if (s.claimable === null) return false;
    const idx = s.claimable;
    const stage = DAILY_CHALLENGE_STAGES[idx]!;
    this.#game.grantCoins(stage.reward);
    this.#summon.addFragments(FRAGMENTS_PER_CHALLENGE_STAGE);
    this.#_claimed.update((set) => new Set(set).add(idx));
    this.persist();
    const next = this.status();
    if (next.done) {
      // Full ladder cleared → an Elder Shard (permanent income, never resets).
      this.#game.grantElder(1);
      this.#notify.show(
        `🏆 Daily challenge complete — +1 Elder Shard (+5% income forever)! Come back tomorrow.`,
      );
    } else {
      this.#notify.show(
        `⚔️ Challenge stage ${idx + 1}/${s.total} cleared — +${stage.reward}¢! Next: win ${this.currentStage().fights} today.`,
      );
    }
    return true;
  }

  private load() {
    try {
      const raw = this.#storage.get(CHALLENGE_KEY);
      if (!raw) return;
      const s: ChallengeSave = JSON.parse(raw);
      this.#_day.set(s.day ?? '');
      this.#_winsAtDayStart.set(Math.max(0, Math.floor(s.winsAtDayStart ?? 0)));
      this.#_claimed.set(new Set((s.claimed ?? []).filter((n) => Number.isInteger(n))));
    } catch {
      /* corrupted save — start fresh */
    }
  }

  private persist() {
    try {
      this.#storage.set(
        CHALLENGE_KEY,
        JSON.stringify({
          day: this.#_day(),
          winsAtDayStart: this.#_winsAtDayStart(),
          claimed: [...this.#_claimed()],
        } satisfies ChallengeSave),
      );
    } catch {
      /* storage blocked — keep in memory */
    }
  }
}
