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
import { levelScale, STAR_STAT_BONUS } from '@poke/battle';
import { Notify } from '@poke/notify';
import { DetailPanel } from '@poke/features/shared/detail-panel/detail-panel';
import { AppDialog, BasicView } from '@shared/ui';

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
  /** Species this pokémon can evolve into right now (null = not ready). */
  evolvesTo: string | null;
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
  #dialog = inject(AppDialog);

  /** Collection cards enriched with every display value the template needs. */
  readonly team = computed<TeamRow[]>(() => {
    const out: TeamRow[] = [];
    for (const owned of this.game.roster()) {
      const xpPct = Math.floor(this.game.xpPercent(owned.name));
      const xpNeed = Math.floor(this.game.xpNeedForLevel(owned.name));
      const xpCurrent = Math.floor(this.game.xpCurrent(owned.name));
      const evolution = this.evolutionStep(owned.name, owned.level);
      out.push({
        owned,
        isFielded: this.game.squad().includes(owned.name),
        sprite: owned.shiny
          ? this.data.shinySpriteUrl(owned.name)
          : this.data.spriteUrlOrEmpty(owned.name),
        pending: this.game.pendingLevels(owned.name),
        xpPct,
        xpLabel: this.xpDisplay.mode() === 'pct' ? `${xpPct}%` : `${xpCurrent} / ${xpNeed} XP`,
        scaledStats: this.scaledStats(owned),
        evolvesTo: evolution,
      });
    }
    return out;
  });

  /** The first evolution step ready at (or below) the given level, if any. */
  private evolutionStep(name: string, level: number): string | null {
    const steps = this.data.evolutionFor(name);
    const step = steps.find((s) => {
      // Only steps that START from this species count — the chain cache maps
      // every member of a chain to the full flattened list, so a Charizard
      // would otherwise match the Charmander → Charmeleon step.
      if (s.species !== name) return false;
      const m = s.trigger.match(/^level (\d+)$/);
      return m ? level >= Number(m[1]) : false;
    });
    return step?.to ?? null;
  }

  /** Evolve an owned pokémon into its ready stage. */
  evolve(name: string) {
    const owned = this.game.own(name);
    if (!owned) return;
    const to = this.evolutionStep(name, owned.level);
    if (!to) return;
    if (this.game.evolve(name, to)) {
      this.#notify.show(`🎉 ${name} evolved into ${to}!`);
    }
  }

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

  /** Level-scaled stats for an owned pokémon. */
  private scaledStats(owned: OwnedPoke): ScaledStats | null {
    const base = this.data.pokeByName(owned.name);
    if (!base) return null;
    const k = levelScale(owned.level) * (1 + STAR_STAT_BONUS * (owned.stars ?? 0));
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

  /** Confirm + release a pokémon for coins (clears the collection slot). */
  transfer(name: string) {
    const owned = this.game.own(name);
    if (!owned) return;
    const value = this.game.releaseValue(owned.level);
    this.#dialog
      .open({
        type: 'warn',
        title: `Release ${name}?`,
        message: `You'll get ${value}¢ and ${name} leaves your collection (and the squad if fielded). This can't be undone.`,
        actionLabel: `Release for ${value}¢`,
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        const got = this.game.release(name);
        if (got) this.#notify.show(`${name} released — +${got}¢.`);
      });
  }

  /** Apply all banked level-ups for all owned Pokémon. */
  levelUpAll() {
    const count = this.game.applyAllLevelUps();
    if (count) this.#notify.show(`${count} Pokémon levelled up!`);
  }

  /** Handle drag-drop between squad slots and collection (slot-aware). */
  onDrop(event: CdkDragDrop<string[]>) {
    const name = event.item.data;
    if (event.container.id === 'squad-drop') {
      if (event.previousContainer.id === 'squad-drop') {
        // Reorder within the squad bar.
        this.reorderSquad(event.previousIndex, event.currentIndex);
        return;
      }
      // From collection: insert at the target slot (replace when full).
      const squad = this.game.squad();
      const next = [...squad];
      if (next.length >= SQUAD_MAX) {
        next[event.currentIndex] = name;
      } else {
        next.splice(Math.min(event.currentIndex, next.length), 0, name);
      }
      this.game.setSquad(next);
    } else if (event.previousContainer.id === 'squad-drop') {
      // Dropping back to collection: remove from squad.
      this.game.setSquad(this.game.squad().filter((n) => n !== name));
    }
  }

  /** Move a squad member from one slot index to another. */
  private reorderSquad(from: number, to: number) {
    const squad = [...this.game.squad()];
    const [moved] = squad.splice(from, 1);
    if (moved === undefined) return;
    squad.splice(Math.min(to, squad.length), 0, moved);
    this.game.setSquad(squad);
  }

  /**
   * Field/Bench button: benches when fielded, fields when there's room, and
   * opens the swap modal when the squad is full (the discoverable replacement
   * for the old double-click shortcut).
   */
  fieldOrSwap(name: string) {
    if (this.game.squad().includes(name)) {
      this.game.setSquad(this.game.squad().filter((n) => n !== name));
      return;
    }
    if (this.game.squad().length < SQUAD_MAX) {
      this.game.setSquad([...this.game.squad(), name]);
    } else {
      this.swapModal.set({ incoming: name });
    }
  }

  /** Remove a squad member (explicit bench button on each slot). */
  bench(name: string) {
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

  /** Close the swap modal only when the overlay itself (not a bubbled child click) is hit. */
  onOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) this.cancelSwap();
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
      if (names.length) {
        // Fire-and-forget warmups MUST swallow rejections: an unhandled
        // rejection trips the dev-server error overlay and covers the app.
        this.data.ensureInCache(names).catch(() => undefined);
        // Evolution readiness needs the species + chain warmed.
        this.data
          .ensureSpecies(names)
          .then(() => this.data.ensureChainFor(names))
          .catch(() => undefined);
      }
    });
  }
}
