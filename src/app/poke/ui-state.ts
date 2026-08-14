import { signal, Service } from '@angular/core';

/** Tab indexes for the `<app-poke-hub>` tab group (no router — screens are tabs). */
export const TAB_SQUAD = 0;
export const TAB_POKEDEX = 1;
export const TAB_ADVENTURE = 2;
export const TAB_ARENA = 3;
export const TAB_USER = 4;
export const TAB_QUESTS = 5;

/**
 * Tiny cross-tab coordinator: lets any screen (e.g. the Pokédex' "Found in →
 * go catch it") switch the whole hub to another tab.
 */
@Service()
export class UiState {
  #_tab = signal(TAB_SQUAD);
  readonly tab = this.#_tab.asReadonly();

  goToTab(index: number) {
    this.#_tab.set(index);
  }
}
