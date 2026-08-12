import { InjectionToken } from '@angular/core';

/**
 * Central, injectable game tuning (mirrors APP/ `SETTINGS_TOKEN` + settings
 * loading): instead of sprinkling magic numbers, services read from
 * `GAME_CONFIG` and a provider can override it per environment.
 */
export interface GameConfig {
  /** Max squad energy (pots/energy refills cap here). */
  energyMax: number;
  /** Energy regenerated per real second (full in ~10 min at 0.17). */
  energyRegenPerSec: number;
  /** Cap for offline/idle earnings while the tab is closed (ms). */
  offlineCapMs: number;
  /** Max creatures concurrently fielded in the arena. */
  squadMax: number;
  /** Starter roster for a brand-new save. */
  startingPoke: string[];
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  energyMax: 100,
  energyRegenPerSec: 0.17,
  offlineCapMs: 8 * 60 * 60 * 1000,
  squadMax: 6,
  startingPoke: ['bulbasaur', 'charmander', 'squirtle'],
};

export const GAME_CONFIG = new InjectionToken<GameConfig>('GAME_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_GAME_CONFIG,
});
