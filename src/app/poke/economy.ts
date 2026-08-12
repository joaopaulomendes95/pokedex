/** Coin cost to buy a single +1 level of training (paid level-up). */
export function trainCost(level: number): number {
  return Math.round(30 * Math.pow(1.25, level - 1));
}

/** XP needed to go from one level to the next. */
export function xpForLevel(level: number): number {
  return 20 + level * 10;
}

/** Base price to buy a brand-new level-1 monster (raw stat totals). */
export function priceFor(detail: {
  stats: {
    hp: number;
    attack: number;
    defense: number;
    spAtk: number;
    spDef: number;
    speed: number;
  };
}): number {
  return (
    detail.stats.hp +
    detail.stats.attack +
    detail.stats.defense +
    detail.stats.spAtk +
    detail.stats.spDef +
    detail.stats.speed
  );
}

/** Cost of one Pokéball: stronger monsters (bigger base exp) cost more. */
export function ballCost(baseExperience: number): number {
  return 15 + Math.round(baseExperience * 0.3);
}

/** Probability (0..1) a ball catches a monster with the given base exp. */
export function catchChance(baseExperience: number): number {
  if (baseExperience <= 0) return 1;
  return Math.min(1, 40 / baseExperience);
}

/** Shop item definitions. */
export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  /** Max stack in inventory (0 = unlimited). */
  maxStack?: number;
}

/** Available shop items. */
export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'pokeball',
    name: 'Pokéball',
    description: 'Standard ball for catching wild Pokémon.',
    price: 50,
    icon: 'sports_handball',
    maxStack: 999,
  },
  {
    id: 'greatball',
    name: 'Great Ball',
    description: 'Higher catch rate (1.5×) for tougher Pokémon.',
    price: 200,
    icon: 'sports_handball',
    maxStack: 999,
  },
  {
    id: 'ultraball',
    name: 'Ultra Ball',
    description: 'Best catch rate (2×) for legendary Pokémon.',
    price: 600,
    icon: 'sports_handball',
    maxStack: 999,
  },
  {
    id: 'potion',
    name: 'Potion',
    description: 'Use to restore 20 squad energy.',
    price: 100,
    icon: 'healing',
    maxStack: 999,
  },
  {
    id: 'superpotion',
    name: 'Super Potion',
    description: 'Use to restore 40 squad energy.',
    price: 300,
    icon: 'healing',
    maxStack: 999,
  },
  {
    id: 'hyperpotion',
    name: 'Hyper Potion',
    description: 'Use to restore 60 squad energy.',
    price: 800,
    icon: 'healing',
    maxStack: 999,
  },
  {
    id: 'energydrink',
    name: 'Energy Drink',
    description: 'Use to restore 50 squad energy.',
    price: 150,
    icon: 'local_cafe',
    maxStack: 999,
  },
  {
    id: 'revive',
    name: 'Revive',
    description: 'Use to restore full squad energy.',
    price: 500,
    icon: 'backup',
    maxStack: 999,
  },
];
