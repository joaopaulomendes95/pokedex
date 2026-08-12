import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DecimalPipe } from '@angular/common';
import { PokeDataService } from '@poke/poke-data.service';
import { GameService } from '@poke/game.service';
import { xpForLevel, trainCost as trainCostFn } from '@poke/economy';
import { levelScale } from '@poke/battle.service';
import { OwnedPoke } from '@poke/poke.model';
import { XpDisplayService } from '@poke/xp-display.service';

/**
 * Shared "Poké-Card" detail panel: artwork, types, stat grid and the buy /
 * train / banked level-up actions. Used by the Market (purchase lane) and the
 * Squad (collection inspector) so both screens show the same stats + training.
 */
@Component({
  selector: 'app-poke-detail-panel',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule, DecimalPipe],
  templateUrl: './detail-panel.component.html',
  styleUrl: './detail-panel.component.scss',
})
export class DetailPanelComponent {
  constructor(
    public data: PokeDataService,
    public game: GameService,
    public xpDisplay: XpDisplayService,
  ) {}

  xpNeed = (level: number) => xpForLevel(level);
  xpInt = (xp: number) => Math.floor(xp);
  trainCost = (level: number) => trainCostFn(level);

  /** XP readout honoring the global flat/% toggle. */
  xpLabel(entry: OwnedPoke): string {
    if (this.xpDisplay.mode() === 'pct') return `${this.progress(entry)}%`;
    return `${this.xpInt(entry.xp)}/${this.xpNeed(entry.level)} XP`;
  }

  /** The owned pokémon behind the selected dex card, if any. */
  ownedOwned(): OwnedPoke | null {
    const name = this.data.selected()?.name;
    return name ? (this.game.own(name) ?? null) : null;
  }

  /** XP bar fill % for an owned pokémon (0..100). */
  progress(owned: OwnedPoke): number {
    const need = xpForLevel(owned.level);
    return Math.min(100, Math.floor((owned.xp / need) * 100));
  }

  /** Banked level-ups waiting to be clicked. */
  pending(owned: OwnedPoke): number {
    return this.game.pendingLevels(owned.name);
  }

  /** Stats escalados para o level actual do owned. */
  scaledStats(owned: OwnedPoke) {
    const base = this.data.detail();
    if (!base) return null;
    const k = levelScale(owned.level);
    return {
      hp: Math.max(1, Math.round(base.stats.hp * k)),
      attack: Math.max(1, Math.round(base.stats.attack * k)),
      defense: Math.max(1, Math.round(base.stats.defense * k)),
      spAtk: Math.max(1, Math.round(base.stats.spAtk * k)),
      spDef: Math.max(1, Math.round(base.stats.spDef * k)),
      speed: Math.max(1, Math.round(base.stats.speed * k)),
    };
  }

  /** Whether the current pokémon has at least one banked level-up. */
  ready() {
    const o = this.ownedOwned();
    return o ? this.pending(o) > 0 : false;
  }

  /** Price to purchase a brand-new level-1 monster (raw stat totals). */
  price(): number {
    return this.rawTotal() ?? 300;
  }

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
    const o = this.ownedOwned();
    if (!o) return;
    if (this.game.spend(this.trainCost(o.level))) this.game.addLevel(o.name, 1);
  }

  /** Consumes every banked level-up (free, banked by battles/idle). */
  bank() {
    const name = this.data.selected()?.name;
    if (!name) return;
    this.game.applyLevelUps(name);
  }
}
