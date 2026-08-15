import { computed, inject, signal, Service } from '@angular/core';
import { BrowserStorage } from '@core/services/storage';
import { Cup, getEliteCups } from '@poke/tournament';

const ELITE_KEY = 'poke-league-elite';

/** The localStorage key Elite Series progress lives under (for save import/export). */
export const ELITE_SERIES_KEY = ELITE_KEY;

interface EliteSave {
  rank: number;
  cupsWon: number;
}

/**
 * The endless post-Champion-Cup tournament ladder. Every Elite Series cup won
 * ranks the player up one series (harder rivals, bigger prizes) and counts on
 * a lifetime `cupsWon` counter. Persisted so the infinite grind survives
 * reloads and prestiges.
 */
@Service()
export class EliteSeries {
  #_rank = signal(0);
  #_cupsWon = signal(0);
  readonly rank = this.#_rank.asReadonly();
  readonly cupsWon = this.#_cupsWon.asReadonly();

  /** Human-readable series number (rank 0 → "Series 1"). */
  readonly seriesNumber = computed(() => this.#_rank() + 1);

  /** The three cups of the current series. */
  readonly cups = computed<Cup[]>(() => getEliteCups(this.#_rank()));

  #storage = inject(BrowserStorage);

  constructor() {
    this.load();
  }

  /** Register a won Elite Series cup: rank up + lifetime counter. */
  wonCup() {
    this.#_cupsWon.update((c) => c + 1);
    this.#_rank.update((r) => r + 1);
    this.persist();
  }

  /** Persist the current elite progress immediately (used by save export). */
  flush(): void {
    this.persist();
  }

  private load() {
    try {
      const raw = this.#storage.get(ELITE_KEY);
      if (!raw) return;
      const s: EliteSave = JSON.parse(raw);
      this.#_rank.set(Math.max(0, Math.floor(s.rank ?? 0)));
      this.#_cupsWon.set(Math.max(0, Math.floor(s.cupsWon ?? 0)));
    } catch {
      /* corrupted save — start fresh */
    }
  }

  private persist() {
    try {
      this.#storage.set(
        ELITE_KEY,
        JSON.stringify({ rank: this.#_rank(), cupsWon: this.#_cupsWon() } satisfies EliteSave),
      );
    } catch {
      /* storage blocked — keep in memory */
    }
  }
}
