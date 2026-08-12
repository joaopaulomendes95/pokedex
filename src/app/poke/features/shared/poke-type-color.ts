import { type CustomChipColor } from '@shared/ui';

/** Type → chip colour (APP/CustomChip palette). */
const TYPE_COLORS: Record<string, CustomChipColor> = {
  normal: 'desat',
  fire: 'orange',
  water: 'main',
  electric: 'yellow',
  grass: 'green',
  ice: 'main-light',
  fighting: 'red',
  poison: 'purple',
  ground: 'yellow',
  flying: 'main-light',
  psychic: 'orange',
  bug: 'green',
  rock: 'desat',
  ghost: 'purple',
  dragon: 'orange',
  dark: 'purple',
  steel: 'desat',
  fairy: 'orange',
};

/** Chip colour for a Pokémon type (exposed for templates). */
export function typeColor(t: string): CustomChipColor {
  return TYPE_COLORS[t] ?? 'desat';
}

/** The full Pokémon type list (for filterable columns / chips). */
export const ALL_TYPES = Object.keys(TYPE_COLORS);
