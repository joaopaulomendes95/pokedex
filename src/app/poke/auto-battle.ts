import { computed, effect, inject, signal, Service } from '@angular/core';
import { Game } from '@poke/game';
import { MatchRunner } from '@poke/match.runner';
import { Notify } from '@poke/notify';
import { QUICK_BATTLE_ENERGY } from '@poke/tournament';
import { poolAroundTier, sampleRivalTeam } from '@poke/rivals';

/** Milliseconds between auto-battles. */
const AUTO_INTERVAL_MS = 4000;

/**
 * The idle autoplay loop: while toggled on, runs a quick fight every few
 * seconds against a rival from the current tier, spends the energy, and
 * collects the payout — the "grind happens while you watch" mechanic.
 */
@Service()
export class AutoBattle {
  readonly autoPlaying = signal(false);
  /** How many auto-fights have resolved so far (activity pulse for the UI). */
  readonly fightCount = signal(0);

  /** Whether an auto-fight can start right now (squad + energy). */
  canAutoFight = computed(
    () =>
      this.#game.squad().length > 0 &&
      this.#game.energy() >= QUICK_BATTLE_ENERGY &&
      !this.#runner.busy(),
  );

  #game = inject(Game);
  #runner = inject(MatchRunner);
  #notify = inject(Notify);

  #timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    // Keep the loop in sync with the toggle (single interval, stops on disable).
    effect(() => {
      if (this.autoPlaying()) this.startLoop();
      else this.stopLoop();
    });
  }

  start() {
    if (!this.#game.squad().length) {
      this.#notify.show('Field a squad on the Squad tab first.');
      return;
    }
    this.autoPlaying.set(true);
    this.#notify.show('Auto-battle on — battles run while you watch.');
  }

  stop() {
    this.autoPlaying.set(false);
    this.#notify.show('Auto-battle off.');
  }

  toggle() {
    if (this.autoPlaying()) this.stop();
    else this.start();
  }

  private startLoop() {
    this.stopLoop();
    this.#timer = setInterval(() => void this.fight(), AUTO_INTERVAL_MS);
  }

  private stopLoop() {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = undefined;
  }

  private async fight() {
    if (!this.canAutoFight()) return;
    if (!this.#game.spendEnergy(QUICK_BATTLE_ENERGY)) return;
    const tier = Math.min(Math.max(this.#game.tier(), 0), 8);
    const pool = [...new Set(poolAroundTier(tier))];
    const rival = sampleRivalTeam(pool, Math.min(3, pool.length));
    await this.#runner.play(rival, this.#game.tier() + 1);
    this.#runner.collect();
    this.fightCount.update((n) => n + 1);
  }
}
