import { PokeLocation } from '@poke/poke.model';

/**
 * Adventure "world map". PokeAPI has no real adjacency graph between the 1533
 * location-areas, so we curate a chain of regions (Kanto's most iconic zones)
 * that unlock in sequence: you can only travel to the areas of your current
 * region, and the next region opens once every area of the previous one has
 * been explored.
 */

export interface RegionDef {
  id: string;
  /** Human name shown on the map. */
  name: string;
  /** Short blurb for the region card. */
  tagline: string;
  /** Representative PokeAPI location-area IDs for imagery (fallbacks). */
  artAreaIds: number[];
  /** Real, explorable location-areas in this region. */
  areas: PokeLocation[];
}

const area = (id: number, name?: string): PokeLocation => ({
  name: name ?? `area-${id}`,
  url: `https://pokeapi.co/api/v2/location-area/${id}/`,
});

/** The unlock chain, in travel order. */
export const KANTO_REGIONS: RegionDef[] = [
  {
    id: 'pallet',
    name: 'Pallet & Route',
    tagline: 'Begin your journey at home. Explore Pallet Town and Route 1.',
    artAreaIds: [285, 295],
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
    artAreaIds: [321, 297],
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
    artAreaIds: [298, 281],
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
    artAreaIds: [292, 1203],
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
    artAreaIds: [345, 277],
    areas: [
      area(284, 'Fuchsia City'),
      area(345, 'Safari Zone Middle'),
      area(306, 'Route 13'),
      area(277, 'Sea Route 19'),
    ],
  },
  {
    id: 'final',
    name: 'Cinnabar & League',
    tagline: 'The power plant, the end-zone, and the road to the Elite Four.',
    artAreaIds: [294, 1202],
    areas: [
      area(294, 'Victory Road'),
      area(330, 'Power Plant'),
      area(279, 'Cinnabar Island'),
      area(1202, 'Indigo Plateau'),
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
