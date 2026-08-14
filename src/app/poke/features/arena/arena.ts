import { Component, computed, effect, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
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
import { AppDialog, BasicView, BattleLog } from '@shared/ui';
import { ManualBattle } from '@poke/manual-battle';
import type { ArenaFighter } from '@poke/match.runner';

/** A fighter row enriched with every display value the template needs. */
interface FighterView {
  name: string;
  level: number;
  sprite: string;
  hpPct: number;
}

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
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    BasicView,
    BattleLog,
  ],
  templateUrl: './arena.component.html',
  styleUrl: './arena.component.scss',
})
export class Arena {
  // Injected dependencies
  readonly runner = inject(MatchRunner);
  readonly game = inject(Game);
  readonly data = inject(PokeData);
  readonly auto = inject(AutoBattle);
  readonly manual = inject(ManualBattle);
  readonly cupRuns = inject(CupRuns);
  #notify = inject(Notify);
  #dialog = inject(AppDialog);

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

  /** Player/rival fighters enriched for the template (sprite + hp%). */
  readonly playerView = computed<FighterView[]>(() => this.toFighterViews(this.runner.player()));
  readonly rivalView = computed<FighterView[]>(() => this.toFighterViews(this.runner.rival()));

  /** Cup progress track dots (0..battles-1). */
  readonly cupTrackDots = computed<number[]>(() =>
    Array.from({ length: this.cupRun()?.cup.battles ?? 0 }, (_, i) => i),
  );
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

  /** Quick fight: a small rival team drawn from your tier's pool. */
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

  /** Start a manual turn-by-turn battle against a tier-scaled rival team. */
  async startManual() {
    if (this.manual.active() || this.runner.busy()) return;
    if (!this.canBattle()) {
      this.#notify.show('Field a squad on the Squad tab first.');
      return;
    }
    if (!this.game.spendEnergy(QUICK_BATTLE_ENERGY)) {
      this.#notify.show('Not enough squad energy — drink an Energy Drink or wait.');
      return;
    }
    const squad = this.game.squad();
    const tier = Math.min(Math.max(this.game.tier(), 0), 8);
    const pool = [...new Set(poolAroundTier(tier))];
    const rival = sampleRivalTeam(pool, Math.min(3, pool.length));
    await this.data.ensureInCache([...squad, ...rival]);
    await this.data.ensureMoves([...squad, ...rival]).catch(() => undefined);

    const playerTeam = this.runner.spawn(squad, this.game.tier() + 1, false);
    const rivalTeam = this.runner.spawn(rival, this.game.tier() + 3, true);
    this.manual.start(
      playerTeam.map((f) => f.fighter),
      rivalTeam.map((f) => f.fighter),
    );
  }

  /** HP percentage for a fighter's bar (manual battle). */
  hpPct(f: { hp: number; maxHp: number }): number {
    return Math.round((f.hp / Math.max(1, f.maxHp)) * 100);
  }

  constructor() {
    // Pay out once when a manual battle ends.
    effect(() => {
      const winner = this.manual.winner();
      if (!winner) return;
      this.game.award(winner);
      if (winner === 'player') {
        for (const f of this.manual.player()) this.game.grantXp(f.name, 8 + this.game.tier() * 2);
        this.#notify.show('Manual battle won — coins + XP banked!');
      } else {
        this.#notify.show('Manual battle lost — your squad needs more training.');
      }
    });
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
  private toFighterViews(fighters: ArenaFighter[]): FighterView[] {
    return fighters.map((f) => ({
      name: f.name,
      level: f.fighter.level ?? 1,
      sprite: this.data.spriteUrlOrEmpty(f.name),
      hpPct: Math.round((f.fighter.hp / Math.max(1, f.fighter.maxHp)) * 100),
    }));
  }
}
