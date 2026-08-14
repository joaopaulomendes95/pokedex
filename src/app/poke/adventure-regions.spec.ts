import { describe, expect, it } from 'vitest';
import {
  KANTO_REGIONS,
  regionStatuses,
  regionUrls,
  artworkUrlForDexId,
  WORLD_ZONES,
  zoneAreaUrls,
} from '@poke/adventure-regions';

describe('world map', () => {
  it('covers every era PokeAPI has location-areas for (gen 1 → gen 8)', () => {
    expect(KANTO_REGIONS.length).toBeGreaterThanOrEqual(13);
    const gens = new Set(KANTO_REGIONS.map((r) => r.gen));
    expect([...gens].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('gives every region real, resolvable areas', () => {
    for (const region of KANTO_REGIONS) {
      expect(region.areas.length).toBeGreaterThanOrEqual(3);
      for (const loc of region.areas) {
        expect(loc.url).toMatch(/^https:\/\/pokeapi\.co\/api\/v2\/location-area\/\d+\/$/);
      }
    }
  });

  it('keeps later regions locked until the previous one is cleared', () => {
    const visited = new Set(KANTO_REGIONS[0]!.areas.map((a) => a.url));
    const statuses = regionStatuses(visited);
    expect(statuses[0]!.cleared).toBe(true);
    expect(statuses[1]!.unlocked).toBe(true);
    expect(statuses[2]!.unlocked).toBe(false);
    // Deep regions stay locked until the whole chain before them is done.
    expect(statuses.at(-1)!.unlocked).toBe(false);
  });

  it('unlocks progressively through the whole chain', () => {
    const visited = new Set<string>();
    for (const region of KANTO_REGIONS) {
      const before = regionStatuses(visited);
      const idx = before.findIndex((s) => s.def.id === region.id);
      expect(before[idx]!.unlocked).toBe(true);
      expect(before[idx]!.cleared).toBe(false);
      for (const a of region.areas) visited.add(a.url);
    }
    const all = regionStatuses(visited);
    expect(all.every((s) => s.cleared)).toBe(true);
  });

  it('provides working artwork URLs per region', () => {
    for (const region of KANTO_REGIONS) {
      const url = artworkUrlForDexId(region.signature);
      expect(url).toMatch(/official-artwork\/\d+\.png$/);
    }
    expect(regionUrls(KANTO_REGIONS[0]!).size).toBe(KANTO_REGIONS[0]!.areas.length);
  });

  it('groups every region into the 5 macro-zones', () => {
    const covered = WORLD_ZONES.flatMap((z) => z.regionIds);
    expect(new Set(covered).size).toBe(KANTO_REGIONS.length);
    expect(WORLD_ZONES.length).toBe(5);
    // Era ranges tile the generations: 1 | 2-3 | 4-5 | 6-7 | 8.
    expect(WORLD_ZONES.map((z) => [z.genStart, z.gen])).toEqual([
      [1, 1],
      [2, 3],
      [4, 5],
      [6, 7],
      [8, 8],
    ]);
    // Every zone maps to real, resolvable areas.
    for (const zone of WORLD_ZONES) {
      expect(zoneAreaUrls(zone).length).toBeGreaterThan(0);
    }
  });
});
