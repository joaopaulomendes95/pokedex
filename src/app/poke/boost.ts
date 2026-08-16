import { computed, signal, Service } from '@angular/core';

/** Squad energy cost to activate a Focus boost. */
export const FOCUS_ENERGY = 25;
/** How long a Focus boost lasts (seconds). */
export const FOCUS_DURATION_S = 60;
/** Income/XP multiplier while a Focus boost is active. */
export const FOCUS_MULT = 2;

/**
 * The "Focus" burst (Swarm-Sim-style mutation): a temporary ×2 income + ×2
 * passive XP window, started by spending squad energy. Deliberately has NO
 * Game dependency — the UI spends the energy and calls `activate`; Game
 * reads the multiplier one-way (no circular DI).
 */
@Service()
export class Boost {
  #_active = signal(false);
  #_endsAt = signal(0);
  readonly active = this.#_active.asReadonly();

  /** Seconds left in the current boost (0 when idle). */
  readonly secondsLeft = computed(() => {
    if (!this.#_active()) return 0;
    return Math.max(0, Math.ceil((this.#_endsAt() - Date.now()) / 1000));
  });

  /** Income/XP multiplier (FOCUS_MULT while active, 1 otherwise). */
  readonly multiplier = computed(() => (this.#_active() ? FOCUS_MULT : 1));

  constructor() {
    // Watch the window and flip off when it expires.
    setInterval(() => {
      if (this.#_active() && Date.now() >= this.#_endsAt()) this.#_active.set(false);
    }, 500);
  }

  /** Start a Focus boost for `durationS` seconds. */
  activate(durationS = FOCUS_DURATION_S): void {
    this.#_active.set(true);
    this.#_endsAt.set(Date.now() + durationS * 1000);
  }
}
