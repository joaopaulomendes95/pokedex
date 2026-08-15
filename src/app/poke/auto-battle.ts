import { computed, effect, inject, signal, Service } from '@angular/core';
import { Game } from '@poke/game';
import { MatchRunner } from '@poke/match.runner';
import { Notify } from '@poke/notify';
import { QUICK_BATTLE_ENERGY } from '@poke/tournament';
import { gatedRivalPool, sampleRivalTeam } from '@poke/rivals';
import { PokeData } from '@poke/poke-data';

/** Milliseconds between auto-battles. */
const AUTO_INTERVAL_MS = 4000;

/**
 * The idle autoplay loop: while toggled on, runs a quick fight every few
 * seconds against a rival from the current tier, spends the energy, and
 * collects the payout — the "grind happens while you watch" mechanic.
 */
@Service()
export class AutoBattle {
  #_autoPlaying = signal(false);
  /** How many auto-fights have resolved so far (activity pulse for the UI). */
  #_fightCount = signal(0);
  readonly autoPlaying = this.#_autoPlaying.asReadonly();
  readonly fightCount = this.#_fightCount.asReadonly();

  // Session tally shown on the AFK panel while fights run.
  #_sessionWins = signal(0);
  #_sessionLosses = signal(0);
  #_sessionCoins = signal(0);
  readonly sessionWins = this.#_sessionWins.asReadonly();
  readonly sessionLosses = this.#_sessionLosses.asReadonly();
  readonly sessionCoins = this.#_sessionCoins.asReadonly();

  /** Short human line about the most recent auto-fight (for the AFK panel). */
  #_lastResult = signal<string>('');
  readonly lastResult = this.#_lastResult.asReadonly();

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
  #data = inject(PokeData);

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
    this.#_sessionWins.set(0);
    this.#_sessionLosses.set(0);
    this.#_sessionCoins.set(0);
    this.#_lastResult.set('');
    this.#_autoPlaying.set(true);
    this.#notify.show('AFK mode on — the app fights by itself while you step away.');
  }

  stop() {
    this.#_autoPlaying.set(false);
    this.#notify.show('AFK mode off — you are back in control.');
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
    const pool = gatedRivalPool(tier, (n) => this.#data.isInMasterList(n));
    const rival = sampleRivalTeam(pool, Math.min(3, pool.length));
    const res = await this.#runner.play(rival, this.#game.tier() + 1);
    this.#runner.collect();
    const coins = res.winner === 'player' ? 10 + this.#game.tier() * 2 : 2;
    if (res.winner === 'player') this.#_sessionWins.update((n) => n + 1);
    else this.#_sessionLosses.update((n) => n + 1);
    this.#_sessionCoins.update((n) => n + coins);
    this.#_lastResult.set(
      res.winner === 'player'
        ? `Win vs ${rival.join(', ')} (+${coins}¢)`
        : `Loss vs ${rival.join(', ')} (+${coins}¢)`,
    );
    this.#_fightCount.update((n) => n + 1);
  }
}
