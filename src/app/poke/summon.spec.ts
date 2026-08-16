import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Summon, SUMMON_TYPES } from '@poke/summon';
import { Game } from '@poke/game';
import { PokeData } from '@poke/poke-data';
import { PokeDetail } from '@poke/poke.model';

/** Stub PokeData with known base-XP species across every rarity band. */
function stubData(): PokeData {
  const defs: { name: string; exp: number }[] = [
    { name: 'pidgey', exp: 50 }, // common
    { name: 'caterpie', exp: 39 }, // common
    { name: 'pikachu', exp: 112 }, // rare
    { name: 'gyarados', exp: 189 }, // epic
    { name: 'dragonite', exp: 270 }, // legendary
  ];
  const detail = (n: string, exp: number): PokeDetail => ({
    id: 1,
    name: n,
    types: ['normal'],
    stats: { hp: 40, attack: 40, defense: 40, spAtk: 40, spDef: 40, speed: 40 },
    spriteUrl: '',
    artworkUrl: '',
    baseExperience: exp,
    moves: [],
    abilities: [],
  });
  const cache = new Map(defs.map((d) => [d.name, detail(d.name, d.exp)]));
  return {
    masterList: () =>
      defs.map((d) => ({ name: d.name, url: `https://pokeapi.co/api/v2/pokemon/${d.name}/` })),
    pokeByName: (n: string) => cache.get(n) ?? null,
    fetchDetailParallel: async (n: string) => cache.get(n) ?? null,
    ensureInCache: async () => undefined,
    registerNameId: () => undefined,
  } as unknown as PokeData;
}

describe('Summon rates', () => {
  it("every tier's rates sum to 1", () => {
    for (const t of SUMMON_TYPES) {
      const total = Object.values(t.rates).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1, 5);
    }
  });

  it('rates are advertised per tier', () => {
    const basic = SUMMON_TYPES.find((t) => t.id === 'basic')!;
    expect(basic.rates.common).toBeGreaterThan(basic.rates.legendary);
    expect(basic.pityRarity).toBe('rare');
    expect(basic.pityEvery).toBe(10);
  });
});

describe('Summon service', () => {
  async function mount() {
    TestBed.configureTestingModule({
      providers: [{ provide: PokeData, useValue: stubData() }],
    });
    const summon = TestBed.inject(Summon);
    const game = TestBed.inject(Game);
    await summon.warmBands();
    return { summon, game };
  }

  it('warmBands buckets species by rarity', () => {
    return mount().then(({ summon }) => {
      expect(summon.bandsReady).toBe(true);
    });
  });

  it('a pull spends coins and adds the species', async () => {
    const { summon, game } = await mount();
    const basic = SUMMON_TYPES.find((t) => t.id === 'basic')!;
    game.grantCoins(10_000);
    const before = game.coins();
    const r = summon.pull(basic, () => 0.1)!; // 0.1 < 0.55 → common
    expect(r.rarity).toBe('common');
    expect(game.coins()).toBe(before - basic.cost);
    expect(game.own(r.name)).toBeDefined();
    expect(r.newSpecies).toBe(true);
  });

  it('pity guarantees rare+ on the 10th basic pull', async () => {
    const { summon, game } = await mount();
    const basic = SUMMON_TYPES.find((t) => t.id === 'basic')!;
    game.grantCoins(100_000);
    const alwaysCommon = () => 0; // always rolls the first (common) bucket
    for (let i = 0; i < 9; i++) {
      const r = summon.pull(basic, alwaysCommon)!;
      expect(r.pity).toBe(false);
    }
    expect(summon.pityFor('basic')).toBe(9);
    const tenth = summon.pull(basic, alwaysCommon)!;
    expect(tenth.pity).toBe(true);
    expect(['rare', 'epic', 'legendary']).toContain(tenth.rarity);
    expect(summon.pityFor('basic')).toBe(0);
  });

  it('refuses a pull without coins (nothing spent, nothing added)', async () => {
    const { summon, game } = await mount();
    const legendary = SUMMON_TYPES.find((t) => t.id === 'legendary')!;
    const sizeBefore = game.collection().size;
    expect(summon.pull(legendary, () => 0.5)).toBeNull();
    expect(game.collection().size).toBe(sizeBefore);
  });
});
