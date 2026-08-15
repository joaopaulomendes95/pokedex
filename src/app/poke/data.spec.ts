import { describe, expect, it } from 'vitest';
import { typeMultiplier } from '@poke/type-chart';
import {
  buildZonePool,
  chainIdFromUrl,
  parseAbilityEffect,
  parseChain,
  parseChainUrl,
  parseDetail,
  parseEvolvesFrom,
  parseFlavor,
  parseMove,
  speciesInChain,
} from '@poke/poke-data';
import { trainCost, xpForLevel } from '@poke/economy';

describe('typeMultiplier', () => {
  it('fire > grass', () => {
    expect(typeMultiplier('fire', ['grass'])).toBe(2);
  });

  it('water < fire', () => {
    expect(typeMultiplier('water', ['fire'])).toBe(2);
  });

  it('normal x ghost is 0', () => {
    expect(typeMultiplier('normal', ['ghost'])).toBe(0);
  });

  it('dual types multiply (ghost x normal = 0, no entry for flying → 1)', () => {
    expect(typeMultiplier('ghost', ['normal', 'flying'])).toBe(0);
  });
});

describe('parseDetail', () => {
  it('maps a PokeAPI body into our detail shape', () => {
    const d = parseDetail({
      id: 25,
      name: 'pikachu',
      types: [{ type: { name: 'electric' } }],
      stats: [
        { stat: { name: 'hp' }, base_stat: 35 },
        { stat: { name: 'attack' }, base_stat: 55 },
        { stat: { name: 'defense' }, base_stat: 40 },
        { stat: { name: 'special-attack' }, base_stat: 50 },
        { stat: { name: 'special-defense' }, base_stat: 50 },
        { stat: { name: 'speed' }, base_stat: 90 },
      ],
      sprites: {
        front_default: 'front.png',
        other: { 'official-artwork': { front_default: 'art.png' } },
      },
    });
    expect(d).toMatchObject({
      id: 25,
      name: 'pikachu',
      types: ['electric'],
      spriteUrl: 'front.png',
      artworkUrl: 'art.png',
    });
    expect(d.stats).toMatchObject({ hp: 35, attack: 55, speed: 90 });
  });

  it('survives missing fields', () => {
    const d = parseDetail({});
    expect(d.types).toEqual([]);
    expect(d.stats.hp).toBe(0);
    expect(d.spriteUrl).toBe('');
    expect(d.moves).toEqual([]);
    expect(d.abilities).toEqual([]);
  });

  it('extracts the real level-up moveset (newest version group, capped)', () => {
    const raw = {
      moves: [
        {
          move: { name: 'quick-attack' },
          version_group_details: [
            { level_learned_at: 11, move_learn_method: { name: 'level-up' } },
            { level_learned_at: 6, move_learn_method: { name: 'level-up' } },
          ],
        },
        {
          move: { name: 'thunder-shock' },
          version_group_details: [{ level_learned_at: 1, move_learn_method: { name: 'level-up' } }],
        },
        {
          move: { name: 'tackle' },
          version_group_details: [{ level_learned_at: 5, move_learn_method: { name: 'machine' } }],
        },
      ],
    };
    const d = parseDetail(raw);
    // newest version group wins per move; machine-move excluded; sorted by level.
    expect(d.moves).toEqual([
      { name: 'thunder-shock', level: 1 },
      { name: 'quick-attack', level: 6 },
    ]);
  });

  it('maps a raw move body into a FighterMove', () => {
    const m = parseMove(
      {
        name: 'ember',
        power: 40,
        damage_class: { name: 'physical' },
        type: { name: 'fire' },
      },
      'ember',
    );
    expect(m).toEqual({ name: 'ember', type: 'fire', category: 'physical', power: 40 });

    // status moves keep a token power so battles stay functional.
    const status = parseMove(
      { name: 'growl', power: null, damage_class: { name: 'status' }, type: { name: 'normal' } },
      'growl',
    );
    expect(status.category).toBe('physical');
    expect(status.power).toBeGreaterThan(0);
  });

  it('picks the English dex entry and cleans line breaks', () => {
    const raw = {
      flavor_text_entries: [
        { flavor_text: 'Quando plusieurs se réunissent', language: { name: 'fr' } },
        {
          flavor_text:
            'When several of\nthese POKéMON gather, their\felectricity could build and cause lightning storms.',
          language: { name: 'en' },
        },
      ],
    };
    const flavor = parseFlavor(raw);
    expect(flavor).toBe(
      'When several of these POKéMON gather, their electricity could build and cause lightning storms.',
    );
    expect(parseFlavor({ flavor_text_entries: [] })).toBeNull();
  });

  it('extracts real abilities with the hidden flag', () => {
    const d = parseDetail({
      abilities: [
        { ability: { name: 'overgrow' }, is_hidden: false, slot: 1 },
        { ability: { name: 'chlorophyll' }, is_hidden: true, slot: 3 },
      ],
    });
    expect(d.abilities).toEqual([
      { name: 'overgrow', isHidden: false },
      { name: 'chlorophyll', isHidden: true },
    ]);
  });

  it('picks the English short effect for an ability', () => {
    const raw = {
      effect_entries: [
        {
          short_effect: 'Boosts the Attack stat.',
          effect: 'Boosts Attack by one stage.',
          language: { name: 'en' },
        },
        { short_effect: 'Augmente l\u0027Attaque.', language: { name: 'fr' } },
      ],
    };
    expect(parseAbilityEffect(raw)).toBe('Boosts the Attack stat.');
    expect(parseAbilityEffect({ effect_entries: [] })).toBeNull();
    expect(
      parseAbilityEffect({
        effect_entries: [{ short_effect: 'X $effect_chance', language: { name: 'en' } }],
      }),
    ).toBe('X chance');
  });

  it('flattens an evolution chain into human-readable steps', () => {
    const chain = {
      chain: {
        species: { name: 'bulbasaur', url: '.../1/' },
        evolution_details: [],
        evolves_to: [
          {
            species: { name: 'ivysaur', url: '.../2/' },
            evolution_details: [{ min_level: 16, trigger: { name: 'level-up' } }],
            evolves_to: [
              {
                species: { name: 'venusaur', url: '.../3/' },
                evolution_details: [{ min_level: 32, trigger: { name: 'level-up' } }],
                evolves_to: [],
              },
            ],
          },
        ],
      },
    };
    expect(parseChain(chain)).toEqual([
      { species: 'bulbasaur', to: 'ivysaur', trigger: 'level 16' },
      { species: 'ivysaur', to: 'venusaur', trigger: 'level 32' },
    ]);
    expect(speciesInChain(chain)).toEqual(['bulbasaur', 'ivysaur', 'venusaur']);
  });

  it('reads the species body evolution-chain URL and item triggers', () => {
    expect(
      parseChainUrl({ evolution_chain: { url: 'https://pokeapi.co/api/v2/evolution-chain/1/' } }),
    ).toBe('https://pokeapi.co/api/v2/evolution-chain/1/');
    expect(parseChainUrl({})).toBeNull();

    const stone = {
      chain: {
        species: { name: 'eevee' },
        evolution_details: [],
        evolves_to: [
          {
            species: { name: 'flareon' },
            evolution_details: [{ item: { name: 'fire-stone' }, trigger: { name: 'use-item' } }],
            evolves_to: [],
          },
        ],
      },
    };
    expect(parseChain(stone)[0]).toEqual({
      species: 'eevee',
      to: 'flareon',
      trigger: 'item: fire-stone',
    });
  });
});

describe('market economy', () => {
  it('training costs increase with level', () => {
    expect(trainCost(1)).toBe(30);
    expect(trainCost(2)).toBeGreaterThan(trainCost(1));
    expect(trainCost(5)).toBeGreaterThan(trainCost(3));
  });

  it('xp requirements grow per level', () => {
    expect(xpForLevel(1)).toBe(30);
    expect(xpForLevel(3)).toBeGreaterThan(xpForLevel(1));
  });
});

describe('buildZonePool', () => {
  it('dedupes species, drops beyond the era cap and returns a shuffled pool', () => {
    const area = (name: string, id: number) => ({
      name: 'x',
      pokemon_encounters: [
        { pokemon: { name, url: `https://pokeapi.co/api/v2/pokemon/${id}/` } },
        { pokemon: { name, url: `https://pokeapi.co/api/v2/pokemon/${id}/` } }, // dup
      ],
    });
    const pool = buildZonePool(
      [area('bulbasaur', 1), area('pikachu', 25), area('mewtwo', 150), area('blaziken', 257)],
      2,
    );
    const names = pool.map((p) => p.name).sort();
    // gen-1/gen-2 species kept; blaziken (gen 3, id 257) dropped by the cap.
    expect(names).toEqual(['bulbasaur', 'mewtwo', 'pikachu']);
  });

  it('honors the era cap strictly', () => {
    const pool = buildZonePool(
      [
        {
          name: 'x',
          pokemon_encounters: [
            { pokemon: { name: 'lugia', url: 'https://pokeapi.co/api/v2/pokemon/249/' } },
          ],
        },
      ],
      1,
    );
    expect(pool).toEqual([]); // 249 > gen-1 cap 151
  });
});

describe('parseEvolvesFrom', () => {
  it('extracts the pre-evolution from the species body', () => {
    expect(parseEvolvesFrom({ evolves_from_species: { name: 'charmander' } })).toBe('charmander');
    expect(parseEvolvesFrom({ evolves_from_species: null })).toBeNull();
    expect(parseEvolvesFrom({})).toBeNull();
  });
});

describe('chainIdFromUrl', () => {
  it('extracts the numeric chain id the generated client needs', () => {
    expect(chainIdFromUrl('https://pokeapi.co/api/v2/evolution-chain/42/')).toBe('42');
    expect(chainIdFromUrl('https://pokeapi.co/api/v2/evolution-chain/1')).toBe('1');
    expect(chainIdFromUrl(null)).toBeNull();
    expect(chainIdFromUrl('https://pokeapi.co/api/v2/species/1/')).toBe('1');
  });
});
