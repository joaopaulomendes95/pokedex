import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { BrowserStorage } from '@core/services/storage';
import { ShopDialog } from '@poke/features/shared/shop-dialog/shop-dialog';

/** localStorage key for the navbar expanded/collapsed preference. */
const NAVBAR_KEY = 'poke-navbar-expanded';

import {
  UiState,
  TAB_SQUAD,
  TAB_POKEDEX,
  TAB_ADVENTURE,
  TAB_ARENA,
  TAB_USER,
  TAB_QUESTS,
} from '@poke/ui-state';
import { Game } from '@poke/game';
import { Theme } from '@poke/theme';
import { Missions } from '@poke/missions';

interface NavItem {
  id: number;
  label: string;
  icon: string;
  badge?: number | null;
}

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule, DecimalPipe],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class Navbar {
  #ui = inject(UiState);
  public readonly game = inject(Game);
  #theme = inject(Theme);
  #dialog = inject(MatDialog);
  #storage = inject(BrowserStorage);
  #missions = inject(Missions);

  /** Navbar starts expanded; the toggle collapses it to hover-expand mode. */
  readonly expanded = signal(this.#storage.get(NAVBAR_KEY) !== 'collapsed');
  readonly hovered = signal(false);

  readonly isOpen = computed(() => this.expanded() || this.hovered());

  /** Collapse/expand; preference persists across sessions. */
  toggle() {
    this.expanded.update((v) => !v);
    this.#storage.set(NAVBAR_KEY, this.expanded() ? 'expanded' : 'collapsed');
  }

  /** Nav items — the Idle tab carries a badge with claimable missions. */
  readonly navItems = computed<NavItem[]>(() => {
    // The badge hides while the player is actually looking at the missions.
    const badge = this.currentTab() === TAB_QUESTS ? 0 : this.#missions.readyCount();
    return [
      { id: TAB_SQUAD, label: 'Squad', icon: 'groups' },
      { id: TAB_POKEDEX, label: 'Pokédex', icon: 'menu_book' },
      { id: TAB_ADVENTURE, label: 'Adventure', icon: 'explore' },
      { id: TAB_ARENA, label: 'Arena', icon: 'sports_martial_arts' },
      { id: TAB_QUESTS, label: 'Idle', icon: 'auto_awesome', badge },
      { id: TAB_USER, label: 'Save', icon: 'save' },
    ];
  });

  readonly currentTab = this.#ui.tab;
  readonly themeMode = this.#theme.mode;

  /** Total owned items (bag badge). */
  readonly totalItems = computed(() =>
    Object.values(this.game.inventory()).reduce((sum, n) => sum + n, 0),
  );

  goToTab(index: number) {
    this.#ui.goToTab(index);
  }

  onMouseEnter() {
    this.hovered.set(true);
  }

  onMouseLeave() {
    this.hovered.set(false);
  }

  toggleTheme() {
    this.#theme.toggle();
  }

  /** Open the always-available Shop & Bag (slide-in from the right). */
  openShop(): void {
    this.#dialog.open(ShopDialog, {
      panelClass: ['app-dialog-container', 'details-dialog', 'slideIn-fromRight'],
      autoFocus: false,
    });
  }
}
