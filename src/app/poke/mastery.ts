import { computed, inject, signal, Service } from '@angular/core';
import { BrowserStorage } from '@core/services/storage';

const MASTERY_KEY = 'poke-league-mastery';
/** Mastery stops growing past this level (bonus caps too). */
export const MASTERY_MAX_LEVEL = 10;
/** Fraction of earned XP that also feeds mastery. */
export const MASTERY_FEED = 0.15;
/** Bonus per mastery level: +3% XP gain and +1% income. */
export const MASTERY_XP_BONUS = 0.03;
export const MASTERY_INCOME_BONUS = 0.01;

/** Total XP required to REACH a mastery level (triangular: 50, 150, 300, …). */
export function masteryXpToReach(level: number): number {
  return 50 * ((level * (level + 1)) / 2);
}

/** Mastery level for a total XP amount (0..MASTERY_MAX_LEVEL). */
export function masteryLevel(xp: number): number {
  let level = 0;
  while (level < MASTERY_MAX_LEVEL && xp >= masteryXpToReach(level + 1)) level++;
  return level;
}

/** XP multiplier from mastery (1 = no bonus). */
export function masteryXpMultiplier(level: number): number {
  return 1 + MASTERY_XP_BONUS * level;
}

/** Income multiplier from mastery (1 = no bonus). */
export function masteryIncomeMultiplier(level: number): number {
  return 1 + MASTERY_INCOME_BONUS * level;
}

/** Per-species progress snapshot for the UI. */
export interface MasteryProgress {
  level: number;
  /** XP inside the current level. */
  xpInLevel: number;
  /** XP needed to reach the next level. */
  xpToNext: number;
  /** 0..1 progress toward the next level. */
  pct: number;
}

/**
 * Per-species mastery: every XP a pokémon earns also feeds its species
 * mastery, which in turn boosts that species' XP gain and idle income.
 * Persisted under `poke-league-mastery`; levels are pure and unit-tested.
 */
@Service()
export class Mastery {
  #_xp = signal<Record<string, number>>({});
  readonly xp = this.#_xp.asReadonly();

  totalXp(species: string): number {
    return this.#_xp()[species] ?? 0;
  }

  level(species: string): number {
    return masteryLevel(this.totalXp(species));
  }

  /** XP multiplier for a species (applied by Game.grantXp / tick). */
  xpMultiplier(species: string): number {
    return masteryXpMultiplier(this.level(species));
  }

  /** Income multiplier for a species. */
  incomeMultiplier(species: string): number {
    return masteryIncomeMultiplier(this.level(species));
  }

  /** UI progress for a species. */
  progress(species: string): MasteryProgress {
    const xp = this.totalXp(species);
    const level = masteryLevel(xp);
    const prev = masteryXpToReach(level);
    const next = masteryXpToReach(level + 1);
    return {
      level,
      xpInLevel: xp - prev,
      xpToNext: next - prev,
      pct: next > prev ? Math.min(1, (xp - prev) / (next - prev)) : 1,
    };
  }

  /** The most-mastered species, for the Idle hub list. */
  readonly top = computed(() =>
    Object.entries(this.#_xp())
      .filter(([, xp]) => xp > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, xp]) => ({ name, xp, level: masteryLevel(xp) })),
  );

  /** Grant mastery XP to a species. Persists only on a level-up (cheap). */
  addXp(species: string, amount: number): void {
    if (amount <= 0 || this.level(species) >= MASTERY_MAX_LEVEL) return;
    const before = this.level(species);
    this.#_xp.update((m) => ({ ...m, [species]: (m[species] ?? 0) + amount }));
    if (this.level(species) > before) this.persist();
  }

  #storage = inject(BrowserStorage);

  constructor() {
    this.load();
  }

  private load() {
    try {
      const raw = this.#storage.get(MASTERY_KEY);
      if (!raw) return;
      this.#_xp.set(JSON.parse(raw) as Record<string, number>);
    } catch {
      /* corrupted save — start fresh */
    }
  }

  private persist() {
    try {
      this.#storage.set(MASTERY_KEY, JSON.stringify(this.#_xp()));
    } catch {
      /* storage blocked — keep in memory */
    }
  }
}
