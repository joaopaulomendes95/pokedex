import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DecimalPipe } from '@angular/common';
import { PokeData } from '@poke/poke-data';
import { Game } from '@poke/game';
import { XpDisplay } from '@poke/xp-display';
import { OwnedPoke } from '@poke/poke.model';
import { xpForLevel, trainCost as trainCostFn } from '@poke/economy';
import { levelScale, STAR_STAT_BONUS } from '@poke/battle';
import { typeHex } from '@poke/features/shared/poke-type-color';
import { PokeFullDetails } from '@poke/features/shared/poke-full-details/poke-full-details';
import { AppDialog } from '@shared/ui';

/** Level-scaled stat block for an owned pokémon. */
interface ScaledStats {
  hp: number;
  attack: number;
  defense: number;
  spAtk: number;
  spDef: number;
  speed: number;
}

/**
 * Shared "Poké-Card" detail panel: artwork, types, stat grid and the buy /
 * train / banked level-up actions. Used by the Pokédex and the Squad
 * inspector so both screens show the same stats + training.
 */
@Component({
  selector: 'app-poke-detail-panel',
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule, DecimalPipe],
  templateUrl: './detail-panel.component.html',
  styleUrl: './detail-panel.component.scss',
})
export class DetailPanel {
  readonly data = inject(PokeData);
  readonly game = inject(Game);
  readonly xpDisplay = inject(XpDisplay);
  #dialog = inject(AppDialog);

  /** The owned pokémon behind the selected dex card, if any. */
  readonly owned = computed<OwnedPoke | null>(() => {
    const name = this.data.selected()?.name;
    return name ? (this.game.own(name) ?? null) : null;
  });

  /** True until the artwork fails to load (falls back to the banner gradient). */
  readonly artOk = signal(true);

  /** Type-tinted gradient for the artwork stage (driven by the first type). */
  readonly bannerStyle = computed(() => {
    const d = this.data.detail();
    const t = d?.types?.[0];
    const hex = t ? typeHex(t) : 'var(--app-color-main-50)';
    return {
      background: `linear-gradient(168deg, color-mix(in srgb, ${hex} 82%, #070a12) 0%, color-mix(in srgb, ${hex} 38%, #0a0e17) 58%, #0a0e17 100%)`,
    };
  });

  /** Type chips carrying their classic hex colours. */
  readonly typeChips = computed(() =>
    (this.data.detail()?.types ?? []).map((t) => ({ name: t, hex: typeHex(t) })),
  );

  constructor() {
    effect(
      () => {
        void this.data.selected()?.name;
        this.artOk.set(true);
      },
      { allowSignalWrites: true },
    );
  }

  /** Banked level-ups waiting to be clicked. */
  readonly pending = computed<number>(() => {
    const o = this.owned();
    return o ? this.game.pendingLevels(o.name) : 0;
  });

  /** Whether the current pokémon has at least one banked level-up. */
  readonly ready = computed(() => this.pending() > 0);

  /** XP bar fill % for an owned pokémon (0..100). */
  readonly progress = computed(() => {
    const o = this.owned();
    if (!o) return 0;
    const need = xpForLevel(o.level);
    return Math.min(100, Math.floor((o.xp / need) * 100));
  });

  /** XP readout honoring the global flat/% toggle. */
  readonly xpLabel = computed(() => {
    const o = this.owned();
    if (!o) return '';
    if (this.xpDisplay.mode() === 'pct') return `${this.progress()}%`;
    return `${Math.floor(o.xp)}/${xpForLevel(o.level)} XP`;
  });

  /** Stats scaled to the owned pokémon's level (null until detail is cached). */
  readonly scaledStats = computed<ScaledStats | null>(() => {
    const o = this.owned();
    const base = this.data.detail();
    if (!o || !base) return null;
    const k = levelScale(o.level) * (1 + STAR_STAT_BONUS * (o.stars ?? 0));
    return {
      hp: Math.max(1, Math.round(base.stats.hp * k)),
      attack: Math.max(1, Math.round(base.stats.attack * k)),
      defense: Math.max(1, Math.round(base.stats.defense * k)),
      spAtk: Math.max(1, Math.round(base.stats.spAtk * k)),
      spDef: Math.max(1, Math.round(base.stats.spDef * k)),
      speed: Math.max(1, Math.round(base.stats.speed * k)),
    };
  });

  /** Cost of a paid training level-up for the current pokémon. */
  readonly trainCost = computed(() => {
    const o = this.owned();
    return o ? trainCostFn(o.level) : 0;
  });

  /** Price to purchase a brand-new level-1 monster (raw stat totals). */
  readonly price = computed(() => this.rawTotal() ?? 300);

  private rawTotal(): number | null {
    const d = this.data.pokeByName(this.data.selected()?.name ?? '') ?? this.data.detail();
    if (!d) return null;
    return (
      d.stats.hp + d.stats.attack + d.stats.defense + d.stats.spAtk + d.stats.spDef + d.stats.speed
    );
  }

  buy() {
    const name = this.data.selected()?.name;
    if (!name) return;
    if (this.game.own(name)) return;
    if (this.game.spend(this.price())) {
      this.game.add(name, 1);
      // Ensure sprite ID is registered for the new pokemon
      const detail = this.data.detail();
      if (detail?.id) this.data.registerNameId(name, detail.id);
    }
  }

  train() {
    const o = this.owned();
    if (!o) return;
    if (this.game.spend(this.trainCost())) this.game.addLevel(o.name, 1);
  }

  /** Consumes every banked level-up (free, banked by battles/idle). */
  bank() {
    const name = this.data.selected()?.name;
    if (!name) return;
    this.game.applyLevelUps(name);
  }

  /** Open the dedicated full-details dialog for the selected pokémon. */
  openFullDetails() {
    const name = this.data.selected()?.name;
    if (!name) return;
    this.#dialog.openDetails({
      name,
      headline: 'Full details',
      faIcon: 'magnifying-glass',
      content: PokeFullDetails,
      contentData: { name },
    });
  }
}
