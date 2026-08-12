import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { PokeDataService } from '@poke/poke-data.service';
import { GameService } from '@poke/game.service';
import { GenerationFilterService } from '@poke/generation-filter.service';
import { UiStateService, TAB_ADVENTURE } from '@poke/ui-state.service';
import { PokeLocation } from '@poke/poke.model';
import { xpForLevel, trainCost as economyTrainCost } from '@poke/economy';
import { knownHabitatsFor } from '@poke/habitats';
import {
  AppDialogService,
  BasicViewComponent,
  type ColumnDefinition,
  type DialogAction,
  GeneralTileListComponent,
} from '@shared/ui';
import { PokeDetailsContentComponent } from '@poke/features/shared/poke-details-content/poke-details-content.component';

interface DexRow extends Record<string, unknown> {
  name: string;
  url: string;
  id: number;
  types: string[];
  owned: boolean;
}

@Component({
  selector: 'app-poke-pokedex',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    GeneralTileListComponent,
    BasicViewComponent,
  ],
  templateUrl: './pokedex.component.html',
  styleUrl: './pokedex.component.scss',
})
export class PokedexComponent {
  readonly data = inject(PokeDataService);
  readonly game = inject(GameService);
  readonly genFilter = inject(GenerationFilterService);
  private readonly ui = inject(UiStateService);
  private readonly dialog = inject(AppDialogService);

  /**
   * Rows fed to the shared tile list. When the search box has text we switch
   * from the current dex page to results across the WHOLE PokeAPI dex; otherwise
   * it's the current dex page + cached detail enrichments.
   */
  readonly rows = computed<DexRow[]>(() => {
    const source = this.data.searchQuery().trim() ? this.data.searchResults() : this.data.dex();
    return source.map((e) => {
      const d = this.data.pokeByName(e.name);
      return {
        name: e.name,
        url: e.url,
        id: this.idFromUrl(e.url),
        types: d?.types ?? [],
        owned: !!this.game.own(e.name),
      };
    });
  });

  /** Sprite for a tile — CDN URL from the resolvable ID (works for search hits outside the cached dex page). */
  spriteFor(row: DexRow): string {
    if (row.id) {
      return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${row.id}.png`;
    }
    return this.data.spriteUrlOrEmpty(row.name);
  }

  readonly columns: ColumnDefinition<DexRow>[] = [
    { key: 'id', header: 'Dex #', isId: true, sortable: true },
    { key: 'name', header: 'Name', sortable: true },
    { key: 'types', header: 'Types', filterable: true },
  ];

  /** Tile click → slide-in DetailDialog (APP pattern). */
  openDetail(row: DexRow): void {
    // Remember the pre-dialog selection so the dialog doesn't leak a global
    // `selected` into Squad/Market (that was an exploit).
    const previous = this.data.selected();
    this.data.select({ name: row.name, url: row.url });
    const owned = this.game.own(row.name);
    const actions: DialogAction[] = [];
    if (owned) {
      const pending = this.game.pendingLevels(row.name);
      if (pending > 0) {
        actions.push({
          label: `Level Up (${pending} ready)`,
          variant: 'primary',
          appearance: 'filled',
          icon: 'arrow-up',
          handler: () => this.game.applyLevelUps(row.name),
        });
      }
      actions.push({
        label: `Train +1 Lv · ${this.trainCost(owned.level)}¢`,
        appearance: 'tonal',
        icon: 'dumbbell',
        variant: 'delete',
        handler: () => {
          if (this.game.canAfford(this.trainCost(owned.level))) {
            this.game.spend(this.trainCost(owned.level));
            this.game.addLevel(row.name, 1);
          }
        },
      });
    }
    const ref = this.dialog.openDetails({
      name: row.name,
      headline: `Pokédex #${row.id}`,
      faIcon: 'dragon',
      badges: [
        {
          label: owned ? `Owned · Lv ${owned.level}` : 'Not owned',
          color: owned ? 'primary' : 'basic',
        },
        { label: `Gen ${this.genFilter.maxGen()}`, color: 'basic' },
      ],
      content: PokeDetailsContentComponent,
      contentData: { name: row.name },
      actions,
    });

    // Restore the pre-dialog selection once the slide-in closes.
    ref.afterClosed().subscribe(() => {
      if (previous) this.data.select(previous);
      else this.data.clearSelection();
    });
  }

  /** Curated "Found in" display names (instant, offline). */
  curatedHabitats(name: string): string[] {
    return knownHabitatsFor(name);
  }

  /** Real location-areas the player has explored and seen the species in. */
  discoveredHabitats(name: string): PokeLocation[] {
    return this.data.habitatsFor(name);
  }

  /** Go catch it: jump to the Adventure tab already exploring that area. */
  travelTo(loc: PokeLocation) {
    this.data.explore(loc);
    this.ui.goToTab(TAB_ADVENTURE);
  }

  /** Selected owned Pokemon (for the training lane). */
  selectedOwned() {
    const name = this.data.selected()?.name;
    return name ? this.game.own(name) : null;
  }

  /** XP bar fill % for an owned pokémon. */
  progress(owned: { level: number; xp: number }): number {
    const need = xpForLevel(owned.level);
    return Math.min(100, Math.floor((owned.xp / need) * 100));
  }

  /** Cost of a paid training level-up. */
  trainCost(level: number): number {
    return economyTrainCost(level);
  }

  /** Whether the selected pokémon has banked level-ups waiting. */
  ready() {
    const o = this.selectedOwned();
    return o ? this.game.pendingLevels(o.name) > 0 : false;
  }

  /** XP required for the given level. */
  xpNeed(level: number): number {
    return xpForLevel(level);
  }

  /** Banked level-ups for an owned pokémon. */
  pending(owned: { name: string }): number {
    return this.game.pendingLevels(owned.name);
  }

  private idFromUrl(url: string): number {
    return Number(url.match(/\/(\d+)\/?$/)?.[1] ?? 0);
  }
}
