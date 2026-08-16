import { Component, computed, effect, inject, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PokeData } from '@poke/poke-data';
import { Game } from '@poke/game';
import { Mastery } from '@poke/mastery';
import { xpForLevel, trainCost as trainCostFn, ballCost, catchChance } from '@poke/economy';
import { levelScale, STAR_STAT_BONUS } from '@poke/battle';
import { knownHabitatsFor } from '@poke/habitats';
import { generationFromId } from '@poke/generation';
import { typeHex } from '@poke/features/shared/poke-type-color';
import type { PokeDetail } from '@poke/poke.model';

export interface PokeFullDetailsData {
  name: string;
}

/** One node of the evolution chain strip (sprite + stage + trigger). */
interface ChainNode {
  name: string;
  sprite: string;
  trigger: string | null;
  current: boolean;
  owned: boolean;
}

/** A real move enriched for the moves table. */
interface MoveView {
  name: string;
  level: number;
  type: string;
  category: string;
  power: number;
}

/**
 * The dedicated FULL details view ("tudo sobre ele"): artwork, base + scaled
 * stats, real moves with power/type/category, abilities with effect text, the
 * whole evolution chain with sprites and triggers, dex entry, habitats, catch
 * info and training actions. Opened as a large details dialog from the
 * Pokédex and the Squad inspector.
 */
@Component({
  selector: 'app-poke-full-details',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    DecimalPipe,
  ],
  templateUrl: './poke-full-details.component.html',
  styleUrl: './poke-full-details.component.scss',
})
export class PokeFullDetails {
  readonly data = input.required<PokeFullDetailsData>();

  readonly poke = inject(PokeData);
  readonly game = inject(Game);
  readonly mastery = inject(Mastery);

  readonly name = computed(() => this.data().name);
  readonly detail = computed(() => this.poke.pokeByName(this.name()) ?? this.poke.detail());
  readonly owned = computed(() => this.game.own(this.name()) ?? null);

  /** Generation badge from the dex ID. */
  readonly gen = computed(() => {
    const id = this.detail()?.id ?? 0;
    return id > 0 ? generationFromId(id) : 0;
  });

  /** Type chips with their classic hex colors. */
  readonly typeChips = computed(() =>
    (this.detail()?.types ?? []).map((t) => ({ name: t, hex: typeHex(t) })),
  );

  /** Type-tinted gradient behind the artwork hero. */
  heroStyle(d: PokeDetail): Record<string, string> {
    const hex = d.types[0] ? typeHex(d.types[0]) : 'var(--app-color-main-50)';
    return {
      background: `linear-gradient(160deg, color-mix(in srgb, ${hex} 80%, #070a12) 0%, color-mix(in srgb, ${hex} 36%, #0a0e17) 55%, #0a0e17 100%)`,
    };
  }

  /** Stats scaled to the owned level (base stats when not owned). */
  readonly statsView = computed(() => {
    const d = this.detail();
    if (!d) return null;
    const k = this.owned()
      ? levelScale(this.owned()!.level) * (1 + STAR_STAT_BONUS * (this.owned()!.stars ?? 0))
      : 1;
    const scale = (v: number) => Math.max(1, Math.round(v * k));
    return {
      hp: scale(d.stats.hp),
      attack: scale(d.stats.attack),
      defense: scale(d.stats.defense),
      spAtk: scale(d.stats.spAtk),
      spDef: scale(d.stats.spDef),
      speed: scale(d.stats.speed),
      owned: Boolean(this.owned()),
    };
  });

  /** Real moves with power/type/category (from the move cache). */
  readonly movesView = computed<MoveView[]>(() => {
    const d = this.detail();
    if (!d) return [];
    const out: MoveView[] = [];
    for (const m of d.moves) {
      const real = this.poke.moveByName(m.name);
      out.push({
        name: m.name,
        level: m.level,
        type: real?.type ?? 'normal',
        category: real?.category ?? 'physical',
        power: real?.power ?? 0,
      });
    }
    return out;
  });

  /** Abilities with their short effect texts. */
  readonly abilitiesView = computed(() =>
    (this.detail()?.abilities ?? []).map((a) => ({
      name: a.name,
      isHidden: a.isHidden,
      effect: this.poke.abilityEffect(a.name) ?? null,
    })),
  );

  /**
   * The full evolution chain as an ordered species strip: sorted by stage
   * depth (root = base form), every species with its sprite, the trigger
   * between consecutive stages, the current species highlighted.
   */
  readonly chainView = computed<ChainNode[]>(() => {
    const name = this.name();
    const steps = this.poke.evolutionFor(name);
    if (steps.length === 0) return [];

    const names = new Set<string>();
    for (const s of steps) {
      names.add(s.species);
      names.add(s.to);
    }
    // Depth = how many evolutions deep from the base form (evolves_from chain).
    const depth = new Map<string, number>();
    const compute = (n: string): number => {
      const known = depth.get(n);
      if (known !== undefined) return known;
      const from = this.poke.evolvesFrom(n);
      if (!from) {
        depth.set(n, 0);
        return 0;
      }
      const d = compute(from) + 1;
      depth.set(n, d);
      return d;
    };
    for (const n of names) compute(n);

    const ordered = [...names].sort(
      (a, b) => (depth.get(a) ?? 0) - (depth.get(b) ?? 0) || a.localeCompare(b),
    );

    return ordered.map((n, i) => {
      const next = ordered[i + 1];
      const step = steps.find((s) => s.species === n && (!next || s.to === next));
      return {
        name: n,
        sprite: this.poke.spriteUrlOrEmpty(n),
        trigger: step?.trigger ?? null,
        current: n === name,
        owned: Boolean(this.game.own(n)),
      };
    });
  });

  /** Species this one evolves from (null = base form). */
  readonly evolvesFrom = computed(() => this.poke.evolvesFrom(this.name()));

  /** English Pokédex entry. */
  readonly flavor = computed(() => this.poke.speciesFlavor(this.name()));

  /** Curated "found in" + real discovered location-areas. */
  readonly habitats = computed(() => ({
    curated: knownHabitatsFor(this.name()),
    discovered: this.poke.habitatsFor(this.name()),
  }));

  /** Catch difficulty readouts. */
  readonly catchInfo = computed(() => {
    const base = this.detail()?.baseExperience ?? 0;
    return {
      baseXp: base,
      rate: Math.round(Math.min(1, catchChance(base)) * 100),
      ballCost: ballCost(base),
    };
  });

  /** Owned-level helpers. */
  readonly pending = computed(() => {
    const o = this.owned();
    return o ? this.game.pendingLevels(o.name) : 0;
  });
  readonly masteryProgress = computed(() =>
    this.owned() ? this.mastery.progress(this.name()) : null,
  );
  readonly xpPct = computed(() => {
    const o = this.owned();
    return o ? Math.min(100, Math.floor((o.xp / xpForLevel(o.level)) * 100)) : 0;
  });
  readonly trainCost = computed(() => {
    const o = this.owned();
    return o ? trainCostFn(o.level) : 0;
  });

  constructor() {
    // Warm everything this view shows: species (flavor + evolves-from + chain
    // url), the chain itself, abilities and real move data.
    effect(() => {
      const name = this.name();
      if (!name) return;
      this.poke
        .ensureSpecies([name])
        .then(() => this.poke.ensureChainFor([name]))
        .catch(() => undefined);
    });
    effect(() => {
      const names = this.detail()?.abilities.map((a) => a.name) ?? [];
      if (names.length) this.poke.ensureAbilities(names).catch(() => undefined);
    });
    effect(() => {
      const d = this.detail();
      if (d) void this.poke.ensureMoves([d.name]).catch(() => undefined);
    });
  }

  /** Apply banked level-ups (owned only). */
  bank() {
    const o = this.owned();
    if (o) this.game.applyLevelUps(o.name);
  }

  /** Paid +1 level. */
  train() {
    const o = this.owned();
    if (!o) return;
    if (this.game.spend(this.trainCost())) this.game.addLevel(o.name, 1);
  }

  /** Evolve into the ready next stage (owned only). */
  evolve() {
    const o = this.owned();
    if (!o) return;
    const step = this.readyLevelStep(o.name, o.level);
    if (!step) return;
    if (this.game.evolve(o.name, step.to)) {
      this.poke.registerNameId(step.to, this.poke.pokeByName(step.to)?.id ?? 0);
    }
  }

  /** The first level-triggered step the owned pokémon qualifies for, if any. */
  private readyLevelStep(name: string, level: number) {
    return this.poke.evolutionFor(name).find((s) => {
      if (s.species !== name) return false;
      const m = s.trigger.match(/^level (\d+)$/);
      return m ? level >= Number(m[1]) : false;
    });
  }

  /** Whether the owned pokémon can evolve right now (level requirement met). */
  readonly canEvolve = computed(() => {
    const o = this.owned();
    if (!o || this.evolvesFrom() !== null) return false;
    return Boolean(this.readyLevelStep(o.name, o.level));
  });
}
