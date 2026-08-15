import { type CustomChipColor } from '@shared/ui';

/** Type → chip colour */
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

/** Canonical Pokémon type hexes (classic palette) — drives type chips,
 * dex tiles and the detail-panel art banner. */
export const TYPE_HEX: Record<string, string> = {
  normal: '#A8A77A',
  fire: '#EE8130',
  water: '#6390F0',
  electric: '#F7D02C',
  grass: '#7AC74C',
  ice: '#96D9D6',
  fighting: '#C22E28',
  poison: '#A33EA1',
  ground: '#E2BF65',
  flying: '#A98FF3',
  psychic: '#F95587',
  bug: '#A6B91A',
  rock: '#B6A136',
  ghost: '#735797',
  dragon: '#6F35FC',
  dark: '#705746',
  steel: '#B7B7CE',
  fairy: '#D685AD',
};

/** Classic hex for a Pokémon type (falls back to a neutral slate). */
export function typeHex(t: string): string {
  return TYPE_HEX[t] ?? '#8a919c';
}

/** Chip colour for a Pokémon type (exposed for templates). */
export function typeColor(t: string): CustomChipColor {
  return TYPE_COLORS[t] ?? 'desat';
}

/** The full Pokémon type list (for filterable columns / chips). */
export const ALL_TYPES = Object.keys(TYPE_COLORS);
