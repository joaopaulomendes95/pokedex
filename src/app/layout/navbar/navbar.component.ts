import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { ShopDialogComponent } from '@poke/features/shared/shop-dialog/shop-dialog.component';
import {
  UiStateService,
  TAB_SQUAD,
  TAB_POKEDEX,
  TAB_ADVENTURE,
  TAB_ARENA,
  TAB_USER,
  TAB_QUESTS,
} from '@poke/ui-state.service';
import { GameService } from '@poke/game.service';
import { ThemeService } from '@poke/theme.service';

interface NavItem {
  id: number;
  label: string;
  icon: string;
  badge?: number | null;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule, DecimalPipe],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  private readonly ui = inject(UiStateService);
  public readonly game = inject(GameService);
  private readonly theme = inject(ThemeService);
  private readonly dialog = inject(MatDialog);

  readonly expanded = signal(false);
  readonly hovered = signal(false);

  readonly isOpen = computed(() => this.expanded() || this.hovered());

  readonly navItems: NavItem[] = [
    { id: TAB_SQUAD, label: 'Squad', icon: 'groups' },
    { id: TAB_POKEDEX, label: 'Pokédex', icon: 'menu_book' },
    { id: TAB_ADVENTURE, label: 'Adventure', icon: 'explore' },
    { id: TAB_ARENA, label: 'Arena', icon: 'sports_martial_arts' },
    { id: TAB_QUESTS, label: 'Idle', icon: 'auto_awesome', badge: 0 },
    { id: TAB_USER, label: 'Save', icon: 'save' },
  ];

  constructor() {
    // Update idle badge with mission claim count
    setInterval(() => {
      const idleItem = this.navItems.find((i) => i.id === TAB_QUESTS);
      if (idleItem) {
        // This will be updated via signal in template
      }
    }, 5000);
  }

  readonly currentTab = this.ui.tab;

  goToTab(index: number) {
    this.ui.goToTab(index);
  }

  onMouseEnter() {
    this.hovered.set(true);
  }

  onMouseLeave() {
    this.hovered.set(false);
  }

  toggle() {
    this.expanded.update((v) => !v);
  }

  readonly themeMode = this.theme.mode;

  /** Total owned items (bag badge). */
  readonly totalItems = computed(() =>
    Object.values(this.game.inventory()).reduce((sum, n) => sum + n, 0),
  );

  toggleTheme() {
    this.theme.toggle();
  }

  /** Open the always-available Shop & Bag (slide-in from the right). */
  openShop(): void {
    this.dialog.open(ShopDialogComponent, {
      panelClass: ['app-dialog-container', 'details-dialog', 'slideIn-fromRight'],
      autoFocus: false,
    });
  }
}
