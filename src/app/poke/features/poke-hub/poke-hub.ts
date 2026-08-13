import { Component, OnInit, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { CommonModule } from '@angular/common';
import { GenerationFilter } from '@poke/generation-filter';
import { PokeData } from '@poke/poke-data';
import { Game } from '@poke/game';
import {
  UiState,
  TAB_SQUAD,
  TAB_POKEDEX,
  TAB_ADVENTURE,
  TAB_ARENA,
  TAB_USER,
  TAB_QUESTS,
} from '@poke/ui-state';
import { SquadBuilder } from '@poke/features/squad-builder/squad-builder';
import { Pokedex } from '@poke/features/pokedex/pokedex';
import { Adventure } from '@poke/features/adventure/adventure';
import { Arena } from '@poke/features/arena/arena';
import { User } from '@poke/features/user/user';
import { Quests } from '@poke/features/quests/quests';

@Component({
  selector: 'app-poke-hub',
  imports: [
    CommonModule,
    MatIconModule,
    MatToolbarModule,
    SquadBuilder,
    Pokedex,
    Adventure,
    Arena,
    User,
    Quests,
  ],
  templateUrl: './poke-hub.component.html',
  styleUrl: './poke-hub.component.scss',
})
export class PokeHub implements OnInit {
  #ui = inject(UiState);
  readonly tab = this.#ui.tab;

  income = computed(() => `${this.game.incomePerSec().toFixed(1)}¢/s`);
  tierName = computed(() => this.game.tierDef().name);
  winsDisplay = computed(() => `${this.game.wins()}/${this.game.winsToPromote()}`);
  coins = computed(() => Math.floor(this.game.coins()));
  energy = computed(() => this.game.energyInt());

  readonly data = inject(PokeData);
  readonly game = inject(Game);
  readonly genFilter = inject(GenerationFilter);

  /** Named tab indexes for the template's @switch. */
  readonly tabs = {
    squad: TAB_SQUAD,
    pokedex: TAB_POKEDEX,
    adventure: TAB_ADVENTURE,
    arena: TAB_ARENA,
    user: TAB_USER,
    quests: TAB_QUESTS,
  };

  /** Warm the first dex entries so the very first battle can start instantly. */
  ngOnInit() {
    void this.data.warmup();
  }
}
