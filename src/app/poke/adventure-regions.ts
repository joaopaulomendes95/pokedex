import { PokeLocation } from '@poke/poke.model';

/**
 * Adventure "world map". PokeAPI has no real adjacency graph between its 1533
 * location-areas, so we curate a chain of iconic regions that unlock in
 * sequence: you can only travel to the areas of your current region, and the
 * next region opens once every area of the previous one has been explored.
 *
 * Coverage spans every era PokeAPI's location-areas exist for (gen 1 → gen 8;
 * Paldea has no location-area data). All area IDs are verified to resolve and
 * to carry pokémon encounters.
 */

export interface RegionDef {
  id: string;
  /** Human name shown on the map. */
  name: string;
  /** Short blurb for the region card. */
  tagline: string;
  /** Game era this region belongs to (drives the "world progress" meter). */
  gen: number;
  /** Dex ID of the region's signature Pokémon (official-artwork art). */
  signature: number;
  /** Real, explorable location-areas in this region. */
  areas: PokeLocation[];
}

const area = (id: number, name?: string): PokeLocation => ({
  name: name ?? `area-${id}`,
  url: `https://pokeapi.co/api/v2/location-area/${id}/`,
});

/** The unlock chain, in travel order (Kanto → Galar). */
export const KANTO_REGIONS: RegionDef[] = [
  {
    id: 'pallet',
    name: 'Pallet & Route',
    tagline: 'Begin your journey at home. Explore Pallet Town and Route 1.',
    gen: 1,
    signature: 25, // Pikachu
    areas: [
      area(285, 'Pallet Town'),
      area(295, 'Route 1'),
      area(280, 'Viridian City'),
      area(296, 'Route 2 South'),
    ],
  },
  {
    id: 'forest',
    name: 'Viridian Forest',
    tagline: 'Bug-infested woods on the road through to Pewter.',
    gen: 1,
    signature: 12, // Butterfree
    areas: [
      area(321, 'Viridian Forest'),
      area(297, 'Route 3'),
      area(1200, 'Pewter City'),
      area(290, 'Mount Moon'),
    ],
  },
  {
    id: 'cerulean',
    name: 'Cerulean Cities',
    tagline: 'The route to the east, the bridge, and the coast above Cerulean.',
    gen: 1,
    signature: 54, // Psyduck
    areas: [
      area(298, 'Route 4'),
      area(281, 'Cerulean City'),
      area(314, 'Route 24'),
      area(315, 'Route 25'),
    ],
  },
  {
    id: 'caves',
    name: 'Rock & Tunnel',
    tagline: 'Underground passages, the diggles, and Saffron town.',
    gen: 1,
    signature: 51, // Dugtrio
    areas: [
      area(292, 'Rock Tunnel'),
      area(317, "Diglett's Cave"),
      area(302, 'Route 8'),
      area(1203, 'Saffron City'),
    ],
  },
  {
    id: 'safari',
    name: 'Safari & Sea',
    tagline: 'The game reserve, the coastal routes and Fuchsia.',
    gen: 1,
    signature: 115, // Kangaskhan
    areas: [
      area(284, 'Fuchsia City'),
      area(345, 'Safari Zone Middle'),
      area(306, 'Route 13'),
      area(277, 'Sea Route 19'),
    ],
  },
  {
    id: 'league',
    name: 'Cinnabar & League',
    tagline: 'The power plant, the end-zone, and the road to the Elite Four.',
    gen: 1,
    signature: 6, // Charizard
    areas: [
      area(294, 'Victory Road'),
      area(330, 'Power Plant'),
      area(279, 'Cinnabar Island'),
      area(1202, 'Indigo Plateau'),
    ],
  },
  {
    id: 'johto',
    name: 'Johto',
    tagline: 'New Bark to the coast — the land across the sea.',
    gen: 2,
    signature: 249, // Lugia
    areas: [
      area(184, 'New Bark Town'),
      area(189, 'Violet City'),
      area(211, 'Ecruteak City'),
      area(224, 'Olivine City'),
    ],
  },
  {
    id: 'hoenn',
    name: 'Hoenn',
    tagline: 'Petalburg to the Ever Grande — where land, sea and sky meet.',
    gen: 3,
    signature: 384, // Rayquaza
    areas: [
      area(350, 'Petalburg City'),
      area(352, 'Lilycove City'),
      area(353, 'Mossdeep City'),
      area(355, 'Ever Grande City'),
    ],
  },
  {
    id: 'sinnoh',
    name: 'Sinnoh',
    tagline: 'Canalave to the Pokémon League, over Mount Coronet.',
    gen: 4,
    signature: 445, // Garchomp
    areas: [
      area(1, 'Canalave City'),
      area(4, 'Sunyshore City'),
      area(5, 'Pokémon League'),
      area(11, 'Mount Coronet'),
    ],
  },
  {
    id: 'unova',
    name: 'Unova',
    tagline: 'The wide-open routes of the western region.',
    gen: 5,
    signature: 635, // Hydreigon
    areas: [
      area(623, 'Route 1'),
      area(624, 'Route 2'),
      area(576, 'Striaton City'),
      area(577, 'Driftveil City'),
    ],
  },
  {
    id: 'kalos',
    name: 'Kalos',
    tagline: 'Verdant valleys and the coastal highway.',
    gen: 6,
    signature: 658, // Greninja
    areas: [
      area(713, 'Route 2'),
      area(714, 'Route 3'),
      area(710, 'Cyllage City'),
      area(722, 'Route 11'),
    ],
  },
  {
    id: 'alola',
    name: 'Alola',
    tagline: 'Island routes under the tropical sun.',
    gen: 7,
    signature: 791, // Solgaleo
    areas: [
      area(1089, 'Iki Town'),
      area(1046, 'Route 4'),
      area(1050, 'Route 7'),
      area(1056, 'Route 11'),
    ],
  },
  {
    id: 'galar',
    name: 'Galar',
    tagline: 'The final frontier — industrial cities and the Wild Area.',
    gen: 8,
    signature: 887, // Dragapult
    areas: [
      area(912, 'Postwick'),
      area(843, 'Route 1'),
      area(906, 'Motostoke'),
      area(892, 'Hammerlocke'),
    ],
  },
];

/** Status of a region for the given visited set. */
export interface RegionStatus {
  def: RegionDef;
  index: number;
  visitedCount: number;
  cleared: boolean;
  unlocked: boolean;
}

export function regionStatuses(visited: ReadonlySet<string>): RegionStatus[] {
  return KANTO_REGIONS.map((def, index) => {
    const visitedCount = def.areas.filter((l) => visited.has(l.url)).length;
    const cleared = visitedCount >= def.areas.length;
    const unlocked =
      index === 0 || KANTO_REGIONS[index - 1]!.areas.every((l) => visited.has(l.url));
    return { def, index, visitedCount, cleared, unlocked };
  });
}

/** All area URLs in a region for quick membership checks. */
export function regionUrls(def: RegionDef): Set<string> {
  return new Set(def.areas.map((l) => l.url));
}

/** Official-artwork CDN URL for a dex ID (real, working imagery). */
export function artworkUrlForDexId(dexId: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dexId}.png`;
}

/**
 * Adventure macro-zones: the 13 regions grouped into 5 "main" zones so the
 * world reads as a few big destinations instead of a long chip rail.
 */
export interface WorldZone {
  id: string;
  name: string;
  tagline: string;
  /** Dex ID of the zone's signature Pokémon (official-artwork art). */
  signature: number;
  /** Era cap for the wild pool (encounters up to this generation). */
  gen: number;
  /** First generation covered by this zone (pool shows gens genStart..gen). */
  genStart: number;
  /** Region ids (in `KANTO_REGIONS`) that belong to this zone. */
  regionIds: string[];
}

export const WORLD_ZONES: WorldZone[] = [
  {
    id: 'kanto',
    name: 'Kanto',
    tagline: 'Where every journey begins — from Pallet Town to the Indigo Plateau.',
    signature: 25, // Pikachu
    gen: 1,
    genStart: 1,
    regionIds: ['pallet', 'forest', 'cerulean', 'caves', 'safari', 'league'],
  },
  {
    id: 'johto-hoenn',
    name: 'Johto & Hoenn',
    tagline: 'Two lands across the sea — traditional cities and the tropical south.',
    signature: 384, // Rayquaza
    gen: 3,
    genStart: 2,
    regionIds: ['johto', 'hoenn'],
  },
  {
    id: 'sinnoh-unova',
    name: 'Sinnoh & Unova',
    tagline: 'The mountainous north and the wide-open west.',
    signature: 445, // Garchomp
    gen: 5,
    genStart: 4,
    regionIds: ['sinnoh', 'unova'],
  },
  {
    id: 'kalos-alola',
    name: 'Kalos & Alola',
    tagline: 'Verdant valleys and sun-soaked island routes.',
    signature: 791, // Solgaleo
    gen: 7,
    genStart: 6,
    regionIds: ['kalos', 'alola'],
  },
  {
    id: 'galar',
    name: 'Galar',
    tagline: 'The industrial frontier — the final region of the world map.',
    signature: 887, // Dragapult
    gen: 8,
    genStart: 8,
    regionIds: ['galar'],
  },
];

/** All area URLs belonging to a zone. */
export function zoneAreaUrls(zone: WorldZone): string[] {
  return KANTO_REGIONS.filter((r) => zone.regionIds.includes(r.id)).flatMap((r) =>
    r.areas.map((a) => a.url),
  );
}
