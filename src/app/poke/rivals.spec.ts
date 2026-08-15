import { describe, expect, it } from 'vitest';
import { gatedRivalPool, poolAroundTier, RIVAL_POOLS } from '@poke/rivals';

/** Simulated save-gen membership: only names whose dex ID is gen 1-2. */
const GEN2_ONLY = new Set([
  'caterpie',
  'weedle',
  'pidgey',
  'rattata',
  'zigzagoon',
  'pidgeotto',
  'raticate',
  'furret',
  'hoothoot',
  'sentret',
  'pidgeot',
  'noctowl',
  'beedrill',
  'butterfree',
  'fearow',
  'charmeleon',
  'wartortle',
  'ivysaur',
  'pikachu',
  'eevee',
  'charizard',
  'blastoise',
  'venusaur',
  'raichu',
  'flareon',
]);
const known = (n: string) => GEN2_ONLY.has(n);

describe('gatedRivalPool', () => {
  it('drops rivals above the save generation', () => {
    const pool = gatedRivalPool(5, known); // tier 5 has gyarados/arcanine/alakazam/machamp/gengar
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every(known)).toBe(true);
  });

  it('falls back to the strongest eligible tier when the current one is empty', () => {
    // Tier 7-8 pools are all gen 3+ legendaries — on a gen-2 save the gate
    // falls back instead of returning an empty team.
    const pool = gatedRivalPool(8, known);
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every(known)).toBe(true);
  });

  it('keeps the full pool when every rival is eligible', () => {
    expect(gatedRivalPool(0, () => true)).toEqual([...new Set(poolAroundTier(0))]);
  });

  it('always returns a non-empty team for any tier on a gen-1+ save', () => {
    for (const tier of Object.keys(RIVAL_POOLS).map(Number)) {
      const pool = gatedRivalPool(tier, known);
      expect(pool.length).toBeGreaterThan(0);
    }
  });
});
