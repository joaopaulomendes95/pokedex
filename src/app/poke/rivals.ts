/** Shared rival-pool + team-sampling helpers used by the Arena and auto-battle. */

/** Rival pools by tier - weaker early, stronger later. */
export const RIVAL_POOLS: Record<number, string[]> = {
  0: ['caterpie', 'weedle', 'pidgey', 'rattata', 'zigzagoon'],
  1: ['pidgeotto', 'raticate', 'furret', 'hoothoot', 'sentret'],
  2: ['pidgeot', 'noctowl', 'beedrill', 'butterfree', 'fearow'],
  3: ['charmeleon', 'wartortle', 'ivysaur', 'pikachu', 'eevee'],
  4: ['charizard', 'blastoise', 'venusaur', 'raichu', 'flareon'],
  5: ['gyarados', 'arcanine', 'alakazam', 'machamp', 'gengar'],
  6: ['dragonite', 'tyranitar', 'metagross', 'salamence', 'slaking'],
  7: ['rayquaza', 'kyogre', 'groudon', 'dialga', 'palkia'],
  8: ['arceus', 'mewtwo', 'necrozma', 'calyrex', 'eternatus'],
};

/** Pool of rivals around a tier (the tier itself plus the next one). */
export function poolAroundTier(tier: number): string[] {
  const t = Math.min(Math.max(tier, 0), 8);
  return [...(RIVAL_POOLS[t] ?? []), ...(RIVAL_POOLS[Math.min(t + 1, 8)] ?? [])];
}

/** Sample a compact rival team (unique names) for a battle. */
export function sampleRivalTeam(pool: string[], size: number): string[] {
  const names = [...new Set(pool)];
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // Both indices are always in range; swap without touching holes.
    const tmp = names[i]!;
    names[i] = names[j]!;
    names[j] = tmp;
  }
  return names.slice(0, Math.max(1, size));
}
