import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Game } from '@poke/game';
import { Summon, SUMMON_TYPES, PullResult, RARITY_ORDER, type Rarity } from '@poke/summon';
import { PokeData } from '@poke/poke-data';
import { BasicView, CustomSpinner } from '@shared/ui';

/** Glow hex per rarity (mirrors the adventure pool colors). */
export const RARITY_HEX: Record<Rarity, string> = {
  common: '#9aa3b2',
  uncommon: '#43b581',
  rare: '#4d9fff',
  epic: '#a06bff',
  legendary: '#ffb347',
};

@Component({
  selector: 'app-poke-summon',
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    DecimalPipe,
    BasicView,
    CustomSpinner,
  ],
  templateUrl: './summon.component.html',
  styleUrl: './summon.component.scss',
})
export class SummonScreen {
  readonly summon = inject(Summon);
  readonly game = inject(Game);
  readonly data = inject(PokeData);

  summonTypes = SUMMON_TYPES;
  rarities = RARITY_ORDER;
  readonly rarityHex = RARITY_HEX;

  coins = computed(() => Math.floor(this.game.coins()));

  /** Last pull result (or null before the first pull). */
  readonly lastPull = signal<PullResult | null>(null);
  readonly pullSprite = computed(() =>
    this.lastPull() ? this.data.spriteUrlOrEmpty(this.lastPull()!.name) : '',
  );

  /** Pity progress label for a tier: "3/10 → guaranteed Rare+". */
  pityLabel(typeId: string, every: number): string {
    const p = this.summon.pityFor(typeId);
    return `${p}/${every} to guaranteed`;
  }

  /** Rate display for a rarity on a tier (percent with 2 decimals for tiny rates). */
  ratePct(typeId: string, rarity: Rarity): string {
    const type = SUMMON_TYPES.find((t) => t.id === typeId);
    const rate = type?.rates[rarity] ?? 0;
    return rate === 0
      ? '—'
      : rate >= 0.01
        ? `${Math.round(rate * 100)}%`
        : `${(rate * 100).toFixed(1)}%`;
  }

  pull(typeId: string) {
    const type = SUMMON_TYPES.find((t) => t.id === typeId);
    if (!type) return;
    const result = this.summon.pull(type);
    if (result) this.lastPull.set(result);
  }

  constructor() {
    // Warm the rarity bands once when the portal opens.
    effect(() => {
      void this.summon.warmBands();
    });
  }
}
