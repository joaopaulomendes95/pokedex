import { Component, computed, effect, inject, signal } from '@angular/core';
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
  Cup,
  CUP_BATTLE_ENERGY,
  QUICK_BATTLE_ENERGY,
  getCupsForTier,
  ruleLabel,
} from '@poke/tournament';
import { gatedRivalPool, sampleRivalTeam, RIVAL_POOLS } from '@poke/rivals';
import { generationFromId } from '@poke/generation';
import { CupRuns } from '@poke/cup-run';
import { EliteSeries } from '@poke/elite-series';
import { DailyChallenge, DAILY_CHALLENGE_STAGES } from '@poke/daily-challenge';
import { Summon, FRAGMENTS_PER_WIN } from '@poke/summon';
import { AppDialog, BasicView, BattleLog } from '@shared/ui';
import { ManualBattle } from '@poke/manual-battle';
import type { ArenaFighter, MatchSummary } from '@poke/match.runner';
import type { FighterMove } from '@poke/poke.model';
import type { BattleEvent } from '@shared/models/battle-event';

/** Arena battle modes — the player picks one up front (manual is the default). */
export type ArenaMode = 'quick' | 'manual' | 'cup';

/** A fighter row enriched with every display value the template needs. */
interface FighterView {
  name: string;
  level: number;
  sprite: string;
  hpPct: number;
}

/** Cup rival pool gated by the save's generation (falls back when empty). */
function poolForCup(cup: Cup, isKnown: (name: string) => boolean): string[] {
  const flat: string[] = [];
  const start = cup.rivalLevel >= 13 ? 6 : cup.rivalLevel >= 8 ? 3 : 0;
  const end = cup.rivalLevel >= 13 ? 9 : cup.rivalLevel >= 8 ? 6 : 3;
  for (let t = start; t < end; t++) {
    flat.push(...(RIVAL_POOLS[t] ?? []));
  }
  const filtered = [...new Set(flat.filter(isKnown))];
  if (filtered.length > 0) return filtered;
  return gatedRivalPool(0, isKnown);
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
  readonly elite = inject(EliteSeries);
  readonly challenge = inject(DailyChallenge);
  readonly summon = inject(Summon);
  #notify = inject(Notify);
  #dialog = inject(AppDialog);

  /** Selected arena mode — manual turn-by-turn battles are the default. */
  #_mode = signal<ArenaMode>('manual');
  readonly mode = this.#_mode.asReadonly();

  setMode(m: ArenaMode) {
    if (this.afk()) return;
    this.#_mode.set(m);
  }

  /** AFK idle-fight mode locks every other arena interaction. */
  readonly afk = computed(() => this.auto.autoPlaying());

  // ---- Collapsible battle logs (preview shows only the last actions) ----
  readonly showQuickLog = signal(false);
  readonly showManualLog = signal(false);
  toggleQuickLog() {
    this.showQuickLog.update((v) => !v);
  }
  toggleManualLog() {
    this.showManualLog.update((v) => !v);
  }

  /** The last `n` events — the collapsed preview of a battle. */
  lastEvents(events: BattleEvent[], n = 2): BattleEvent[] {
    return events.slice(-n);
  }

  /** One-line KO summary for the result panel (intuitive outcome). */
  koLine(s: MatchSummary): string {
    if (s.winner === 'player') {
      return s.rivalLost.length
        ? `You knocked out: ${s.rivalLost.join(', ')}`
        : 'Rival team fainted';
    }
    return s.playerLost.length
      ? `Your squad fainted: ${s.playerLost.join(', ')}`
      : 'Your squad fainted';
  }

  /** Player's selectable moves — falls back to Struggle when none are known. */
  readonly playerMoves = computed<FighterMove[]>(() => {
    const f = this.manual.playerFighter();
    const moves = f?.moves ?? [];
    return moves.length > 0 ? moves : [STRUGGLE_MOVE];
  });

  canBattle = computed(() => this.game.squad().length > 0);
  /** Quick fight unlocked: squad ready and energy to spare. */
  canQuick = computed(() => this.canBattle() && this.game.energy() >= QUICK_BATTLE_ENERGY);
  canCupBattle = computed(() => this.canBattle() && this.game.energy() >= CUP_BATTLE_ENERGY);

  /** Cups available: base cups by ladder tier, endless Elite Series after Champion. */
  cups = computed(() =>
    this.game.tier() >= 4 ? this.elite.cups() : getCupsForTier(this.game.tier()),
  );

  /** Rule chip label helper (exposed for the template). */
  readonly ruleLabel = ruleLabel;

  /** Daily challenge ladder stages (1 → 3 → 5 → 10 wins). */
  readonly challengeStages = DAILY_CHALLENGE_STAGES;

  /** Reward of the stage at `index`. */
  challengeReward(index: number): number {
    return DAILY_CHALLENGE_STAGES[index]?.reward ?? 0;
  }

  /** Progress % toward the current challenge stage. */
  challengePct = computed(() => {
    const s = this.challenge.status();
    if (s.done) return 100;
    const need = DAILY_CHALLENGE_STAGES[Math.min(s.nextStage, s.total - 1)]!.fights;
    return Math.round(Math.min(1, s.winsToday / need) * 100);
  });

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
  start() {
    if (!this.canQuick() || this.runner.busy()) return;
    if (!this.game.spendEnergy(QUICK_BATTLE_ENERGY)) {
      this.#notify.show('Not enough squad energy — drink an Energy Drink or wait.');
      return;
    }
    const tier = Math.min(Math.max(this.game.tier(), 0), 8);
    const pool = gatedRivalPool(tier, (n) => this.data.isInMasterList(n));
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
    const pool = gatedRivalPool(tier, (n) => this.data.isInMasterList(n));
    const rival = sampleRivalTeam(pool, Math.min(3, pool.length));
    try {
      await this.data.ensureInCache([...squad, ...rival]);
    } catch {
      /* best-effort warmup — fighters fall back to generic stats */
    }
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
    // AFK mode is exclusive: entering it quits any in-progress manual battle.
    effect(() => {
      if (this.auto.autoPlaying() && this.manual.active()) this.manual.quit();
    });

    // A new battle collapses any expanded log back to the 2-action preview.
    effect(() => {
      if (this.runner.result()) this.showQuickLog.set(false);
    });
    effect(() => {
      if (this.manual.log().length === 0) this.showManualLog.set(false);
    });

    // Pay out once when a manual battle ends.
    effect(() => {
      const winner = this.manual.winner();
      if (!winner) return;
      this.game.award(winner);
      if (winner === 'player') {
        for (const f of this.manual.player()) this.game.grantXp(f.name, 8 + this.game.tier() * 2);
        this.summon.addFragments(FRAGMENTS_PER_WIN);
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

    // Apply the cup's rule modifiers to the player side before spending energy.
    const rules = run.cup.rules ?? [];
    let squad = this.game.squad();
    const genOnly = rules.find((r) => r.id === 'genOnly')?.value;
    if (genOnly) {
      squad = squad.filter((n) => {
        const id = this.data.pokeByName(n)?.id ?? 0;
        return id > 0 && generationFromId(id) <= genOnly;
      });
    }
    const sizeCap = rules.find((r) => r.id === 'squadSize')?.value;
    if (sizeCap) squad = squad.slice(0, sizeCap);
    if (squad.length === 0) {
      this.#notify.show('No squad member is eligible for this cup — bench them or change rules.');
      return;
    }
    const levelCap = rules.find((r) => r.id === 'levelCap')?.value;
    this.game.spendEnergy(CUP_BATTLE_ENERGY);

    const rival = sampleRivalTeam(
      poolForCup(run.cup, (n) => this.data.isInMasterList(n)),
      run.cup.rivalTeamSize,
    );
    const res = await this.runner.play(rival, run.cup.rivalLevel, squad, levelCap);
    this.runner.collect();

    if (res.winner === 'player') {
      this.game.grantCoins(run.cup.prizePerBattle);
      const wins = [...run.wins, true];
      this.#notify.show(`Battle won — +${run.cup.prizePerBattle}¢!`);
      if (wins.length >= run.cup.battles) {
        this.game.grantCoins(run.cup.finalPrize);
        this.cupRun.set({ cup: run.cup, wins, status: 'won' });
        if (run.cup.series !== undefined) {
          // Elite Series win → rank up into the next, harder series.
          this.elite.wonCup();
          this.#notify.show(
            `Elite Series ${run.cup.series + 1} won! Ranked up — Series ${this.elite.seriesNumber()} unlocked.`,
          );
        } else {
          this.#notify.show(`Cup won! Bonus +${run.cup.finalPrize}¢.`);
        }
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

/** Last-resort move used when a fighter knows no real moves yet. */
const STRUGGLE_MOVE: FighterMove = {
  name: 'struggle',
  type: 'normal',
  category: 'physical',
  power: 25,
};
