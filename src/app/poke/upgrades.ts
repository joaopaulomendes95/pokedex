import { inject, signal, Service } from '@angular/core';
import { BrowserStorage } from '@core/services/storage';

const UPGRADES_KEY = 'poke-league-upgrades';

/** How a leveled upgrade affects the game. */
export type UpgradeEffect =
  | 'income' // +10% idle income per level
  | 'xp' // +5% passive XP per level
  | 'energyCap' // +25 max energy per level
  | 'energyRegen' // +0.05 energy/sec per level
  | 'catch' // +2% catch chance per level
  | 'offlineCap'; // +2h offline cap per level

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  icon: string;
  effect: UpgradeEffect;
  /** Bonus per level (fraction for income/xp/catch, flat for the rest). */
  perLevel: number;
  maxLevel: number;
  /** Coins for the first level. */
  baseCost: number;
  /** Cost multiplier per level (grows the sink). */
  costMult: number;
  /** Human-readable unit for the effect value. */
  unit: string;
}

export const UPGRADES: Upgrade[] = [
  {
    id: 'income',
    name: 'Lucky Coin',
    description: 'Permanent idle income.',
    icon: 'monetization_on',
    effect: 'income',
    perLevel: 0.1,
    maxLevel: 25,
    baseCost: 500,
    costMult: 1.8,
    unit: 'income',
  },
  {
    id: 'xp',
    name: "Scholar's Blessing",
    description: 'Permanent passive XP gain.',
    icon: 'school',
    effect: 'xp',
    perLevel: 0.05,
    maxLevel: 25,
    baseCost: 400,
    costMult: 1.8,
    unit: 'xp',
  },
  {
    id: 'energyCap',
    name: 'Energy Vial',
    description: 'More max squad energy.',
    icon: 'battery_charging_full',
    effect: 'energyCap',
    perLevel: 25,
    maxLevel: 10,
    baseCost: 1000,
    costMult: 2.2,
    unit: 'energy',
  },
  {
    id: 'energyRegen',
    name: 'Power Charger',
    description: 'Faster energy regeneration.',
    icon: 'bolt',
    effect: 'energyRegen',
    perLevel: 0.05,
    maxLevel: 20,
    baseCost: 800,
    costMult: 2,
    unit: 'energy/s',
  },
  {
    id: 'catch',
    name: 'Lucky Charm',
    description: 'Better catch chance on wild Pokémon.',
    icon: 'sports_handball',
    effect: 'catch',
    perLevel: 0.02,
    maxLevel: 10,
    baseCost: 1000,
    costMult: 2.2,
    unit: 'catch',
  },
  {
    id: 'offlineCap',
    name: 'Sleeper Agent',
    description: 'Longer offline earnings window.',
    icon: 'bedtime',
    effect: 'offlineCap',
    perLevel: 2 * 60 * 60 * 1000,
    maxLevel: 10,
    baseCost: 1500,
    costMult: 2.2,
    unit: 'offline',
  },
];

/**
 * Permanent coin-sink upgrades (survive prestige). Holds only levels +
 * derived values; purchases live in the Shop UI (spend coins → levelUp).
 * Never injects Game — Game reads from here one-way (no circular DI).
 */
@Service()
export class Upgrades {
  #_levels = signal<Record<string, number>>({});
  readonly levels = this.#_levels.asReadonly();

  /** Level of one upgrade (0 = not owned). */
  level(id: string): number {
    return this.#_levels()[id] ?? 0;
  }

  /** Whether an upgrade can still be leveled (below max). */
  canLevel(u: Upgrade): boolean {
    return this.level(u.id) < u.maxLevel;
  }

  /** Coins for the next level of an upgrade. */
  cost(u: Upgrade): number {
    return Math.round(u.baseCost * Math.pow(u.costMult, this.level(u.id)));
  }

  /** Multiplicative bonus for fraction-based effects (1 = no bonus). */
  multiplier(effect: UpgradeEffect): number {
    const u = UPGRADES.find((x) => x.effect === effect);
    if (!u) return 1;
    return 1 + u.perLevel * this.level(u.id);
  }

  /** Flat bonus for cap/regen effects. */
  flatBonus(effect: UpgradeEffect): number {
    const u = UPGRADES.find((x) => x.effect === effect);
    if (!u) return 0;
    return u.perLevel * this.level(u.id);
  }

  /** Buy one level (call after the player has paid with coins). */
  levelUp(u: Upgrade): void {
    if (!this.canLevel(u)) return;
    this.#_levels.update((l) => ({ ...l, [u.id]: (l[u.id] ?? 0) + 1 }));
    this.persist();
  }

  /** Display string for the current effect value of an upgrade. */
  effectLabel(u: Upgrade): string {
    const level = this.level(u.id);
    if (level === 0) return 'Not owned';
    switch (u.effect) {
      case 'income':
        return `+${Math.round(u.perLevel * 100 * level)}% income`;
      case 'xp':
        return `+${Math.round(u.perLevel * 100 * level)}% XP`;
      case 'catch':
        return `+${Math.round(u.perLevel * 100 * level)}% catch`;
      case 'energyCap':
        return `+${Math.round(u.perLevel * level)} energy`;
      case 'energyRegen':
        return `+${(u.perLevel * level).toFixed(2)}/s regen`;
      case 'offlineCap':
        return `+${Math.round((u.perLevel * level) / 3_600_000)}h offline`;
    }
  }

  #storage = inject(BrowserStorage);

  constructor() {
    this.load();
  }

  private load() {
    try {
      const raw = this.#storage.get(UPGRADES_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Record<string, number>;
      this.#_levels.set(Object.fromEntries(Object.entries(data).filter(([, v]) => v > 0)));
    } catch {
      /* corrupted save — start fresh */
    }
  }

  private persist() {
    try {
      this.#storage.set(UPGRADES_KEY, JSON.stringify(this.#_levels()));
    } catch {
      /* storage blocked — keep in memory */
    }
  }
}
