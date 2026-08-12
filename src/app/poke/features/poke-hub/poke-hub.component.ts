import { Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { CommonModule } from '@angular/common';
import { GenerationFilterService } from '@poke/generation-filter.service';
import { PokeDataService } from '@poke/poke-data.service';
import { GameService } from '@poke/game.service';
import { UiStateService } from '@poke/ui-state.service';
import { SquadBuilderComponent } from '@poke/features/squad-builder/squad-builder.component';
import { PokedexComponent } from '@poke/features/pokedex/pokedex.component';
import { AdventureComponent } from '@poke/features/adventure/adventure.component';
import { ArenaComponent } from '@poke/features/arena/arena.component';
import { UserComponent } from '@poke/features/user/user.component';
import { QuestsComponent } from '@poke/features/quests/quests.component';

@Component({
  selector: 'app-poke-hub',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatToolbarModule,
    SquadBuilderComponent,
    PokedexComponent,
    AdventureComponent,
    ArenaComponent,
    UserComponent,
    QuestsComponent,
  ],
  templateUrl: './poke-hub.component.html',
  styleUrl: './poke-hub.component.scss',
})
export class PokeHubComponent {
  private readonly ui = inject(UiStateService);
  readonly tab = this.ui.tab;

  income = computed(() => `${this.game.incomePerSec().toFixed(1)}¢/s`);
  tierName = computed(() => this.game.tierDef().name);
  winsDisplay = computed(() => `${this.game.wins()}/${this.game.winsToPromote()}`);
  coins = computed(() => Math.floor(this.game.coins()));
  energy = computed(() => this.game.energyInt());

  constructor(
    public data: PokeDataService,
    public game: GameService,
    public genFilter: GenerationFilterService,
  ) {}

  /** Warm the first dex entries so the very first battle can start instantly. */
  ngOnInit() {
    void this.data.warmup();
  }
}
