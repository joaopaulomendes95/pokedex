import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Game } from '@poke/game';
import { MatchRunner } from '@poke/match.runner';
import { PokeData } from '@poke/poke-data';
import { Notify } from '@poke/notify';
import { AutoBattle } from '@poke/auto-battle';
import {
  CUPS,
  Cup,
  CUP_BATTLE_ENERGY,
  QUICK_BATTLE_ENERGY,
  getCupsForTier,
} from '@poke/tournament';
import { poolAroundTier, sampleRivalTeam, RIVAL_POOLS } from '@poke/rivals';
import { CupRuns } from '@poke/cup-run';
import { AppDialog, BasicView } from '@shared/ui';

function poolForCup(cup: Cup): string[] {
  const flat: string[] = [];
  const start = cup.rivalLevel >= 13 ? 6 : cup.rivalLevel >= 8 ? 3 : 0;
  const end = cup.rivalLevel >= 13 ? 9 : cup.rivalLevel >= 8 ? 6 : 3;
  for (let t = start; t < end; t++) {
    flat.push(...(RIVAL_POOLS[t] ?? []));
  }
  return flat;
}

@Component({
  selector: 'app-poke-arena',
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule, BasicView],
  templateUrl: './arena.component.html',
  styleUrl: './arena.component.scss',
})
export class Arena {
  canBattle = computed(() => this.game.squad().length > 0);
  /** Quick fight unlocked: squad ready and energy to spare. */
  canQuick = computed(() => this.canBattle() && this.game.energy() >= QUICK_BATTLE_ENERGY);
  canCupBattle = computed(() => this.canBattle() && this.game.energy() >= CUP_BATTLE_ENERGY);

  /** Cups available for the current tier (infinite after Champion Cup). */
  cups = computed(() => getCupsForTier(this.game.tier()));

  /** Active cup run — lives on a root service so tab switches don't lose it. */
  get cupRun() {
    return this.cupRuns.run;
  }
  /** Energy cost labels for the template. */
  readonly quickCost = QUICK_BATTLE_ENERGY;
  readonly cupCost = CUP_BATTLE_ENERGY;

  /** Prize shown on the collect button for a finished quick fight. */
  resultCoins = computed(() =>
    this.runner.result()?.winner === 'player' ? 10 + this.game.tier() * 2 : 2,
  );

  /** Expose runner state for the template. */
  result = computed(() => this.runner.result());
  summary = computed(() => this.runner.summary());

  /** Cup progress helpers. */
  cupBattleIndex = computed(() => (this.cupRun()?.wins.length ?? 0) + 1);
  cupProgress = computed(() => {
    const run = this.cupRun();
    if (!run) return 0;
    return Math.round((run.wins.length / run.cup.battles) * 100);
  });

  readonly runner = inject(MatchRunner);
  readonly game = inject(Game);
  readonly data = inject(PokeData);
  readonly auto = inject(AutoBattle);
  #notify = inject(Notify);
  #dialog = inject(AppDialog);
  readonly cupRuns = inject(CupRuns);

  /** Quick fight: a small rival team drawn from your tier's pool. */
  start() {
    if (!this.canQuick() || this.runner.busy()) return;
    if (!this.game.spendEnergy(QUICK_BATTLE_ENERGY)) {
      this.#notify.show('Not enough squad energy — drink an Energy Drink or wait.');
      return;
    }
    const tier = Math.min(Math.max(this.game.tier(), 0), 8);
    const pool = [...new Set(poolAroundTier(tier))];
    const rival = sampleRivalTeam(pool, Math.min(3, pool.length));
    void this.runner.play(rival);
  }

  /** Enter a cup: pays the fee and begins the run. */
  enterCup(cup: Cup) {
    if (!this.canBattle()) {
      this.#notify.show('Field a squad on the Squad tab first.');
      return;
    }
    if (this.cupRun()) return;
    if (!this.game.canAfford(cup.entryFee)) {
      this.#notify.show(`Not enough coins to enter the ${cup.name}.`);
      return;
    }
    this.#dialog
      .open({
        type: 'confirm',
        title: `Enter the ${cup.name}?`,
        message: `This costs ${cup.entryFee}¢ and locks in a ${cup.battles}-battle run for the ${cup.finalPrize}¢ prize.`,
        actionLabel: `Pay ${cup.entryFee}¢`,
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        if (!this.game.spend(cup.entryFee)) return;
        this.cupRun.set({ cup, wins: [], status: 'active' });
        this.#notify.show(`Entered the ${cup.name}! Win ${cup.battles} battles to lift it.`);
      });
  }

  /** Fight the next opponent of the active cup run. */
  async nextCupBattle() {
    const run = this.cupRun();
    if (!run || run.status !== 'active' || this.runner.busy()) return;
    if (!this.canCupBattle()) {
      this.#notify.show('Not enough squad energy for a cup battle — use a Potion or Revive.');
      return;
    }
    this.game.spendEnergy(CUP_BATTLE_ENERGY);

    const rival = sampleRivalTeam(poolForCup(run.cup), run.cup.rivalTeamSize);
    const res = await this.runner.play(rival, run.cup.rivalLevel);
    this.runner.collect();

    if (res.winner === 'player') {
      this.game.grantCoins(run.cup.prizePerBattle);
      const wins = [...run.wins, true];
      this.#notify.show(`Battle won — +${run.cup.prizePerBattle}¢!`);
      if (wins.length >= run.cup.battles) {
        this.game.grantCoins(run.cup.finalPrize);
        this.cupRun.set({ cup: run.cup, wins, status: 'won' });
        this.#notify.show(`Cup won! Bonus +${run.cup.finalPrize}¢.`);
      } else {
        this.cupRun.set({ cup: run.cup, wins, status: 'active' });
      }
    } else {
      this.cupRun.set({ ...run, wins: [...run.wins, false], status: 'lost' });
      this.#notify.show('Eliminated from the cup — no final bonus.');
    }
  }

  /** Abandon the run and go back to the cup lobby. */
  leaveCup() {
    const run = this.cupRun();
    if (!run) return;
    // A finished run (won/lost) is settled — leaving the lobby must not ask
    // to forfeit (and never refund the fee again).
    if (run.status !== 'active') {
      this.cupRun.set(null);
      this.#notify.show('Back to the cup lobby.');
      return;
    }
    this.#dialog
      .open({
        type: 'warn',
        title: 'Leave the cup?',
        message: `You'll forfeit the current ${run.cup.name} run. Entry is not refunded.`,
        actionLabel: 'Forfeit',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) this.cupRun.set(null);
      });
  }

  /** HP percentage for a fighter's bar. */
  hpPct(f: { hp: number; maxHp: number }): number {
    return Math.round((f.hp / Math.max(1, f.maxHp)) * 100);
  }

  /** Battle slot indices 0..battles-1 for a cup's progress track. */
  cupTrack(battles: number): number[] {
    return Array.from({ length: battles }, (_, i) => i);
  }
}
