import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CdkDragDrop, DragDropModule, transferArrayItem } from '@angular/cdk/drag-drop';
import { PokeDataService } from '@poke/poke-data.service';
import { GameService, SQUAD_MAX } from '@poke/game.service';
import { OwnedPoke } from '@poke/poke.model';
import { XpDisplayService } from '@poke/xp-display.service';
import { levelScale } from '@poke/battle.service';
import { NotifyService } from '@poke/notify.service';
import { DetailPanelComponent } from '@poke/features/shared/detail-panel/detail-panel.component';
import { BasicViewComponent } from '@shared/ui';

@Component({
  selector: 'app-poke-squad',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    DragDropModule,
    DetailPanelComponent,
    BasicViewComponent,
  ],
  templateUrl: './squad-builder.component.html',
  styleUrl: './squad-builder.component.scss',
})
export class SquadBuilderComponent {
  readonly xpDisplay = inject(XpDisplayService);
  team = computed(() => {
    const out: { owned: OwnedPoke; isFielded: boolean }[] = [];
    for (const owned of this.game.roster()) {
      out.push({ owned, isFielded: this.game.squad().includes(owned.name) });
    }
    return out;
  });

  sprite(name: string) {
    return this.data.spriteUrlOrEmpty(name);
  }

  /** 0..100 progress bar fill for a collection card. */
  xpPct(owned: OwnedPoke): number {
    return Math.floor(this.game.xpPercent(owned.name));
  }

  /** XP needed for next level (integer). */
  xpNeed(owned: OwnedPoke): number {
    return Math.floor(this.game.xpNeedForLevel(owned.name));
  }

  /** Current XP (integer). */
  xpCurrent(owned: OwnedPoke): number {
    return Math.floor(this.game.xpCurrent(owned.name));
  }

  /** XP readout honoring the global flat/% toggle. */
  xpLabel(owned: OwnedPoke): string {
    if (this.xpDisplay.mode() === 'pct') return `${this.xpPct(owned)}%`;
    return `${this.xpCurrent(owned)} / ${this.xpNeed(owned)} XP`;
  }

  /** Number of ready level-ups banked (waits for a click). */
  pending(name: string): number {
    return this.game.pendingLevels(name);
  }

  /** Total pending level-ups across all owned Pokémon. */
  totalPending = computed(() => {
    let total = 0;
    for (const owned of this.game.roster()) {
      total += this.game.pendingLevels(owned.name);
    }
    return total;
  });

  /** Whether any Pokémon has pending level-ups. */
  hasAnyPending = computed(() => this.totalPending() > 0);

  /** Inspect a collection card in the side panel. */
  inspect(name: string, event?: MouseEvent) {
    if (event && (event.target as HTMLElement).closest('button')) return;
    this.data.selectByName(name);
  }

  /** Apply all banked level-ups for all owned Pokémon. */
  levelUpAll() {
    const count = this.game.applyAllLevelUps();
    if (count) this.notify.show(`${count} Pokémon levelled up!`);
  }

  /** Slot indices the arena squad can hold (6, per SQUAD_MAX). */
  slots = Array.from({ length: SQUAD_MAX }, (_, i) => i);

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

  /** Collection names only (for drag data) - independent of fielded state. */
  collectionNames = computed(() => this.game.roster().map((r) => r.name));

  /** Swap modal state. */
  swapModal = signal<{ incoming: string } | null>(null);

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

  /** Stats escalados para o level actual do owned. */
  scaledStats(owned: OwnedPoke) {
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

  constructor(
    public data: PokeDataService,
    public game: GameService,
    private readonly notify: NotifyService,
  ) {
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
