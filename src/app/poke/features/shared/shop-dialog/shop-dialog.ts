import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Game, CONSUMABLE_ENERGY } from '@poke/game';
import { SHOP_ITEMS, ShopItem } from '@poke/economy';
import { Notify } from '@poke/notify';
import { Upgrades, UPGRADES } from '@poke/upgrades';
import { CustomChip, KpiBlock } from '@shared/ui';

/**
 * Merged Shop + Bag: buy items and use bag consumables from one place,
 * reachable any time.
 */
@Component({
  selector: 'app-shop-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule,
    CustomChip,
    KpiBlock,
  ],
  templateUrl: './shop-dialog.component.html',
  styleUrl: './shop-dialog.component.scss',
})
export class ShopDialog {
  public readonly game = inject(Game);
  readonly upgrades = inject(Upgrades);
  #notify = inject(Notify);
  #dialogRef = inject(MatDialogRef<ShopDialog>);

  shopItems = SHOP_ITEMS;
  upgradeCatalog = UPGRADES;
  coins = computed(() => Math.floor(this.game.coins()));
  energy = computed(() => this.game.energyInt());
  energyMax = computed(() => this.game.energyMax());
  isEnergyFull = computed(() => this.game.energy() >= this.game.energyMax());
  energyPct = computed(() => this.game.energyPct());

  /** Total stocked items in the bag (not spent ones). */
  ownedCount = computed(() => Object.values(this.game.inventory()).reduce((sum, n) => sum + n, 0));

  /** Effective price per item id: consumables scale with tier. */
  prices = computed<Record<string, number>>(() => {
    const mult = 1 + this.game.tier() * 0.25;
    const out: Record<string, number> = {};
    for (const item of SHOP_ITEMS) {
      out[item.id] =
        CONSUMABLE_ENERGY[item.id] !== undefined ? Math.round(item.price * mult) : item.price;
    }
    return out;
  });

  isConsumable(id: string): boolean {
    return CONSUMABLE_ENERGY[id] !== undefined;
  }

  gainFor(id: string): number {
    return CONSUMABLE_ENERGY[id] ?? 0;
  }

  buy(item: ShopItem) {
    const price = this.prices()[item.id];
    if (price === undefined) return;
    if (!this.game.spend(price)) {
      this.#notify.show(`Not enough coins for the ${item.name}.`);
      return;
    }
    this.game.addItem(item.id, 1);
    this.#notify.show(`Bought ${item.name} for ${price}¢.`);
  }

  /** Consume an energy item from the bag (works mid-tournament). */
  use(id: string) {
    if (this.isEnergyFull()) {
      this.#notify.showError('Energy is already full!');
      return;
    }
    const gained = this.game.useConsumable(id);
    if (gained < 0) {
      this.#notify.showError('No more left in the bag.');
      return;
    }
    this.#notify.showSuccess(`Used an item: +${gained} squad energy.`);
  }

  /** Buy one level of a permanent upgrade. */
  buyUpgrade(id: string) {
    const u = UPGRADES.find((x) => x.id === id);
    if (!u) return;
    const cost = this.upgrades.cost(u);
    if (!this.upgrades.canLevel(u)) return;
    if (!this.game.spend(cost)) {
      this.#notify.show(`Not enough coins for ${u.name}.`);
      return;
    }
    this.upgrades.levelUp(u);
    this.#notify.show(`${u.name} upgraded — ${this.upgrades.effectLabel(u)}.`);
  }

  close(): void {
    this.#dialogRef.close();
  }
}
