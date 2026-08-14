import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { A11yModule } from '@angular/cdk/a11y';
import { PokeData } from '@poke/poke-data';
import { Game, SQUAD_MAX } from '@poke/game';
import { OwnedPoke } from '@poke/poke.model';
import { XpDisplay } from '@poke/xp-display';
import { levelScale } from '@poke/battle';
import { Notify } from '@poke/notify';
import { DetailPanel } from '@poke/features/shared/detail-panel/detail-panel';
import { BasicView } from '@shared/ui';

/** Level-scaled stat block for an owned pokémon. */
interface ScaledStats {
  hp: number;
  attack: number;
  defense: number;
  spAtk: number;
  spDef: number;
  speed: number;
}

/** A collection card row enriched with every value the template needs. */
interface TeamRow {
  owned: OwnedPoke;
  isFielded: boolean;
  sprite: string;
  pending: number;
  xpPct: number;
  xpLabel: string;
  scaledStats: ScaledStats | null;
}

/** One of the six fixed squad slots (null = empty, drop here). */
interface SquadSlot {
  name: string;
  sprite: string;
  pending: number;
}

/** A swap-modal target row. */
interface SwapTarget {
  name: string;
  sprite: string;
  pending: number;
}

@Component({
  selector: 'app-poke-squad',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    DragDropModule,
    A11yModule,
    DetailPanel,
    BasicView,
  ],
  templateUrl: './squad-builder.component.html',
  styleUrl: './squad-builder.component.scss',
})
export class SquadBuilder {
  readonly xpDisplay = inject(XpDisplay);
  readonly data = inject(PokeData);
  readonly game = inject(Game);
  #notify = inject(Notify);

  /** Collection cards enriched with every display value the template needs. */
  readonly team = computed<TeamRow[]>(() => {
    const out: TeamRow[] = [];
    for (const owned of this.game.roster()) {
      const xpPct = Math.floor(this.game.xpPercent(owned.name));
      const xpNeed = Math.floor(this.game.xpNeedForLevel(owned.name));
      const xpCurrent = Math.floor(this.game.xpCurrent(owned.name));
      out.push({
        owned,
        isFielded: this.game.squad().includes(owned.name),
        sprite: this.data.spriteUrlOrEmpty(owned.name),
        pending: this.game.pendingLevels(owned.name),
        xpPct,
        xpLabel: this.xpDisplay.mode() === 'pct' ? `${xpPct}%` : `${xpCurrent} / ${xpNeed} XP`,
        scaledStats: this.scaledStats(owned),
      });
    }
    return out;
  });

  /** Fixed 6-slot squad bar (null when a slot is empty). */
  readonly slotEntries = computed<(SquadSlot | null)[]>(() =>
    Array.from({ length: SQUAD_MAX }, (_, i) => {
      const name = this.game.squad()[i];
      if (!name) return null;
      return {
        name,
        sprite: this.data.spriteUrlOrEmpty(name),
        pending: this.game.pendingLevels(name),
      };
    }),
  );

  /** Swap-modal targets = current squad, enriched for the template. */
  readonly swapTargets = computed<SwapTarget[]>(() =>
    this.game.squad().map((name) => ({
      name,
      sprite: this.data.spriteUrlOrEmpty(name),
      pending: this.game.pendingLevels(name),
    })),
  );

  /** Total pending level-ups across all owned Pokémon. */
  readonly totalPending = computed(() => {
    let total = 0;
    for (const owned of this.game.roster()) {
      total += this.game.pendingLevels(owned.name);
    }
    return total;
  });

  /** Whether any Pokémon has pending level-ups. */
  readonly hasAnyPending = computed(() => this.totalPending() > 0);

  /** Collection names only (for drag data) - independent of fielded state. */
  readonly collectionNames = computed(() => this.game.roster().map((r) => r.name));

  /** Swap modal state. */
  readonly swapModal = signal<{ incoming: string } | null>(null);

  /** Level-scaled stats for an owned pokémon (null until its detail is cached). */
  private scaledStats(owned: OwnedPoke): ScaledStats | null {
    const base = this.data.pokeByName(owned.name);
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

  /** Inspect a collection card in the side panel. */
  inspect(name: string, event?: Event) {
    if (event && (event.target as HTMLElement).closest('button')) return;
    this.data.selectByName(name);
  }

  /** Apply all banked level-ups for all owned Pokémon. */
  levelUpAll() {
    const count = this.game.applyAllLevelUps();
    if (count) this.#notify.show(`${count} Pokémon levelled up!`);
  }

  /** Handle drag-drop between squad slots and collection. */
  onDrop(event: CdkDragDrop<string[]>) {
    if (event.previousContainer === event.container) return;

    const name = event.item.data;
    if (event.container.id === 'squad-drop') {
      // Dropping into squad: only if squad has space
      if (this.game.squad().length >= SQUAD_MAX) return;
      this.game.setSquad([...this.game.squad(), name]);
    } else {
      // Dropping back to collection: remove from squad
      this.game.setSquad(this.game.squad().filter((n) => n !== name));
    }
  }

  /** Handle double-click on collection card. */
  onCollectionDblClick(name: string) {
    if (this.game.squad().length < SQUAD_MAX) {
      this.game.setSquad([...this.game.squad(), name]);
    } else {
      this.swapModal.set({ incoming: name });
    }
  }

  /** Handle double-click on squad slot. */
  onSquadDblClick(name: string) {
    this.game.setSquad(this.game.squad().filter((n) => n !== name));
  }

  /** Confirm swap in modal. */
  confirmSwap(outgoing: string) {
    const incoming = this.swapModal()?.incoming;
    if (!incoming) return;
    this.game.setSquad(this.game.squad().map((n) => (n === outgoing ? incoming : n)));
    this.swapModal.set(null);
  }

  cancelSwap() {
    this.swapModal.set(null);
  }

  constructor() {
    // Bring the side panel up on the first-owned monster once the roster lands.
    effect(
      () => {
        const first = this.team()[0]?.owned.name;
        if (first && !this.data.selected()) this.data.selectByName(first);
      },
      { allowSignalWrites: true },
    );

    // Pre-fetch details for all owned pokemon so sprites always work.
    effect(() => {
      const names = this.team().map((t) => t.owned.name);
      if (names.length) this.data.ensureInCache(names);
    });
  }
}
