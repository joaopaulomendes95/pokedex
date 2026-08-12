import { signal, Service } from '@angular/core';

/** Tab indexes for the `<app-poke-hub>` mat-tab-group. */
export const TAB_SQUAD = 0;
export const TAB_POKEDEX = 1;
export const TAB_MARKET = 2;
export const TAB_ADVENTURE = 3;
export const TAB_ARENA = 4;
export const TAB_USER = 5;
export const TAB_QUESTS = 6;

/**
 * Tiny cross-tab coordinator: lets any screen (e.g. the Pokédex' "Found in →
 * go catch it") switch the whole hub to another tab.
 */
@Service()
export class UiStateService {
  readonly tab = signal(TAB_SQUAD);

  goToTab(index: number) {
    this.tab.set(index);
  }
}
