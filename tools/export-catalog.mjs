#!/usr/bin/env node
/**
 * One-time snapshot tool: pulls everything the game uses from PokeAPI into a
 * single local catalog file (public/catalog.json), so the app
 * stops depending on PokeAPI at runtime. The catalog shape is exactly what a
 * future backend (Rust/Go/TS) must serve — see docs/backend-catalog.md.
 *
 * Usage:  node tools/export-catalog.mjs [--max-gen 9] [--concurrency 8]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://pokeapi.co/api/v2';
const GEN_END = { 1: 151, 2: 251, 3: 386, 4: 493, 5: 649, 6: 721, 7: 809, 8: 905, 9: 1025 };

const args = process.argv.slice(2);
const maxGen = Number(args.find((a) => a.startsWith('--max-gen'))?.split('=')[1] ?? 9);
const concurrency = Number(args.find((a) => a.startsWith('--concurrency'))?.split('=')[1] ?? 8);

/** Tiny worker pool. */
async function pool(items, size, fn) {
  const queue = [...items];
  const workers = Array.from({ length: size }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (item !== undefined) await fn(item);
    }
  });
  await Promise.all(workers);
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// --- 1. master list, capped by generation ---
const list = (await getJson(`${API}/pokemon?limit=1025&offset=0`)).results;
const maxId = GEN_END[maxGen] ?? 1025;
const names = list
  .map((e) => ({ name: e.name, id: Number(e.url.match(/(\d+)\/?$/)?.[1]) }))
  .filter((e) => e.id > 0 && e.id <= maxId)
  .map((e) => e.name);

console.log(`Snapshot: ${names.length} species (gen 1-${maxGen}), concurrency ${concurrency}`);

// --- 2. details + species info ---
const creatures = {};
const speciesInfo = {};
const moveNames = new Set();
const abilityNames = new Set();
const chainIds = new Set();
const allEvo = []; // {species, to, trigger}

await pool(names, concurrency, async (name) => {
  try {
    const [d, sp] = await Promise.all([
      getJson(`${API}/pokemon/${name}`),
      getJson(`${API}/pokemon-species/${name}`),
    ]);
    const moves = (d.moves ?? [])
      .map((slot) => {
        const newest = slot.version_group_details?.at(-1);
        if (!newest || newest.move_learn_method?.name !== 'level-up') return null;
        const level = newest.level_learned_at ?? 0;
        if (level <= 0) return null;
        return { name: slot.move?.name, level };
      })
      .filter((m) => m?.name)
      .sort((a, b) => a.level - b.level)
      .slice(0, 8);

    creatures[name] = {
      id: d.id,
      name: d.name,
      types: (d.types ?? []).map((t) => t.type?.name).filter(Boolean),
      stats: {
        hp: stat(d, 'hp'),
        attack: stat(d, 'attack'),
        defense: stat(d, 'defense'),
        spAtk: stat(d, 'special-attack'),
        spDef: stat(d, 'special-defense'),
        speed: stat(d, 'speed'),
      },
      baseExperience: d.base_experience ?? 0,
      spriteUrl: d.sprites?.front_default ?? '',
      artworkUrl: d.sprites?.other?.['official-artwork']?.front_default ?? '',
      moves,
      abilities: (d.abilities ?? [])
        .map((a) => ({ name: a.ability?.name, isHidden: a.is_hidden === true }))
        .filter((a) => a.name),
    };
    for (const m of moves) if (m.name) moveNames.add(m.name);
    for (const a of d.abilities ?? []) if (a.ability?.name) abilityNames.add(a.ability.name);

    const flavor = (sp.flavor_text_entries ?? []).find(
      (f) => f.language?.name === 'en',
    )?.flavor_text;
    const chainId = sp.evolution_chain?.url?.match(/(\d+)\/?$/)?.[1] ?? null;
    speciesInfo[name] = {
      flavor: flavor ? flavor.replace(/[\f\n\r]+/g, ' ').trim() : null,
      evolvesFrom: sp.evolves_from_species?.name ?? null,
      chainId,
    };
    if (chainId) chainIds.add(chainId);
  } catch (err) {
    console.warn(`skip ${name}: ${err.message}`);
  }
});

// --- 3. evolution chains (flattened edges, same trigger labels as the game) ---
async function chainEdges(id) {
  const raw = (await getJson(`${API}/evolution-chain/${id}`)).chain;
  const edges = [];
  const walk = (link) => {
    if (!link?.species?.name) return;
    for (const next of link.evolves_to ?? []) {
      const to = next.species?.name;
      if (!to) continue;
      edges.push({
        species: link.species.name,
        to,
        trigger: triggerLabel(next.evolution_details?.[0]),
      });
      walk(next);
    }
  };
  walk(raw);
  return edges;
}
function triggerLabel(detail) {
  if (!detail) return 'evolution';
  if (detail.min_level) return `level ${detail.min_level}`;
  if (detail.item?.name) return `item: ${detail.item.name}`;
  return detail.trigger?.name ?? 'evolution';
}
const edgesByChain = new Map();
await pool([...chainIds], concurrency, async (id) => {
  try {
    edgesByChain.set(id, await chainEdges(id));
  } catch (err) {
    console.warn(`skip chain ${id}: ${err.message}`);
  }
});
// Denormalize evolvesTo onto each creature.
for (const [name, info] of Object.entries(speciesInfo)) {
  const edges = info.chainId ? (edgesByChain.get(info.chainId) ?? []) : [];
  creatures[name].evolvesTo = edges.filter((e) => e.species === name);
}

// --- 4. moves ---
const moves = {};
await pool([...moveNames], concurrency, async (name) => {
  try {
    const m = await getJson(`${API}/move/${name}`);
    moves[name] = {
      name: m.name,
      type: m.type?.name ?? 'normal',
      category: m.damage_class?.name === 'special' ? 'special' : 'physical',
      power: Math.max(1, m.power ?? 25),
    };
  } catch (err) {
    console.warn(`skip move ${name}: ${err.message}`);
  }
});

// --- 5. abilities ---
const abilities = {};
await pool([...abilityNames], concurrency, async (name) => {
  try {
    const a = await getJson(`${API}/ability/${name}`);
    const entry = (a.effect_entries ?? []).find((e) => e.language?.name === 'en');
    abilities[name] = (entry?.short_effect || entry?.effect || '').replace(/\s+/g, ' ').trim();
  } catch (err) {
    console.warn(`skip ability ${name}: ${err.message}`);
  }
});

// --- 6. adventure zones (the 13 curated regions' areas) ---
const zoneUrls = [
  285, 295, 280, 296, 321, 297, 1200, 290, 298, 281, 314, 315, 292, 317, 302, 1203, 284, 345, 306,
  277, 294, 330, 279, 1202, 184, 189, 211, 224, 350, 352, 353, 355, 1, 4, 5, 11, 623, 624, 576, 577,
  713, 714, 710, 722, 1089, 1046, 1050, 1056, 912, 843, 906, 892,
];
const zones = {};
await pool(zoneUrls, concurrency, async (id) => {
  try {
    const a = await getJson(`${API}/location-area/${id}/`);
    zones[`${API}/location-area/${id}/`] = {
      name: a.name ?? `area-${id}`,
      encounters: (a.pokemon_encounters ?? []).map((e) => e.pokemon?.name).filter(Boolean),
    };
  } catch (err) {
    console.warn(`skip area ${id}: ${err.message}`);
  }
});

// --- write ---
const catalog = {
  app: 'poke-liga-catalog',
  version: 1,
  generatedAt: new Date().toISOString(),
  maxGen,
  creatures,
  moves,
  abilities,
  zones,
};

const out = join(ROOT, 'public/catalog.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(catalog));
console.log(
  `✅ catalog.json written: ${Object.keys(creatures).length} creatures, ` +
    `${Object.keys(moves).length} moves, ${Object.keys(abilities).length} abilities, ` +
    `${Object.keys(zones).length} zones`,
);

function stat(d, name) {
  return d.stats?.find((s) => s.stat?.name === name)?.base_stat ?? 0;
}
