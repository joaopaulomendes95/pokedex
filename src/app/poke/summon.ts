import { computed, inject, signal, Service } from '@angular/core';
import { Game } from '@poke/game';
import { PokeData } from '@poke/poke-data';
import { Notify } from '@poke/notify';
import { rarityFor, type Rarity } from '@poke/features/adventure/adventure';
import { BrowserStorage } from '@core/services/storage';

const SUMMON_KEY = 'poke-league-summon';

/** Fragments earned per won battle (quick/auto/cup/manual). */
export const FRAGMENTS_PER_WIN = 2;
/** Fragments earned per claimed daily-challenge stage. */
export const FRAGMENTS_PER_CHALLENGE_STAGE = 5;
/** Fragments earned per successful catch. */
export const FRAGMENTS_PER_CATCH = 1;

/** The Fragment Forge: trade fragments for a guaranteed free pull. */
export const FRAGMENT_FORGE: { typeId: 'advanced' | 'legendary'; fragments: number }[] = [
  { typeId: 'advanced', fragments: 60 },
  { typeId: 'legendary', fragments: 150 },
];

export type { Rarity };

/** One gacha tier: cost, drop rates and pity guarantee. */
export interface SummonType {
  id: 'basic' | 'advanced' | 'legendary';
  name: string;
  icon: string;
  blurb: string;
  cost: number;
  /** Drop rates per rarity (must sum to 1). */
  rates: Record<Rarity, number>;
  /** Guaranteed rarity (or better) every `pityEvery` pulls. */
  pityRarity: Rarity;
  pityEvery: number;
}

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

/** Basic pulls: cheap, common-leaning. */
export const SUMMON_TYPES: SummonType[] = [
  {
    id: 'basic',
    name: 'Basic Summon',
    icon: 'catching_pokemon',
    blurb: 'A cheap pull for the thrill — Rare+ guaranteed every 10.',
    cost: 200,
    rates: { common: 0.55, uncommon: 0.35, rare: 0.09, epic: 0.009, legendary: 0.001 },
    pityRarity: 'rare',
    pityEvery: 10,
  },
  {
    id: 'advanced',
    name: 'Advanced Summon',
    icon: 'workspace_premium',
    blurb: 'Serious pulls — Epic+ guaranteed every 8.',
    cost: 800,
    rates: { common: 0.15, uncommon: 0.4, rare: 0.3, epic: 0.14, legendary: 0.01 },
    pityRarity: 'epic',
    pityEvery: 8,
  },
  {
    id: 'legendary',
    name: 'Legendary Summon',
    icon: 'military_tech',
    blurb: 'The big leagues — Legendary guaranteed every 5.',
    cost: 3000,
    rates: { common: 0, uncommon: 0, rare: 0.05, epic: 0.65, legendary: 0.3 },
    pityRarity: 'legendary',
    pityEvery: 5,
  },
];

/** One pull result. */
export interface PullResult {
  name: string;
  rarity: Rarity;
  level: number;
  newSpecies: boolean;
  pity: boolean;
}

interface SummonSave {
  pity: Record<string, number>;
  fragments: number;
}

/**
 * The gacha engine: spend coins on a summon tier, roll a rarity by the tier's
 * rates, pull a random species of that rarity from the save's generation,
 * with pity counters guaranteeing the tier's floor. All data comes from the
 * master list — swap PokeAPI for your own backend later and the mechanic
 * survives unchanged.
 */
@Service()
export class Summon {
  #_pity = signal<Record<string, number>>({ basic: 0, advanced: 0, legendary: 0 });
  readonly pity = this.#_pity.asReadonly();

  /** Summon fragments — earned from battles/catches, spent at the Forge. */
  #_fragments = signal(0);
  readonly fragments = this.#_fragments.asReadonly();

  /** Add earned fragments (persists). */
  addFragments(n: number): void {
    if (n <= 0) return;
    this.#_fragments.update((f) => f + n);
    this.persist();
  }

  /** Spend fragments (returns false when short). */
  spendFragments(n: number): boolean {
    if (this.#_fragments() < n) return false;
    this.#_fragments.update((f) => f - n);
    this.persist();
    return true;
  }

  /** Cost (in fragments) of a forge pull for the given summon type id. */
  forgeCost(typeId: string): number {
    return FRAGMENT_FORGE.find((f) => f.typeId === typeId)?.fragments ?? 0;
  }

  /** Trade fragments for a guaranteed pull of the tier (no coins spent). */
  forgePull(typeId: string, rng: () => number = Math.random): PullResult | null {
    const type = SUMMON_TYPES.find((t) => t.id === typeId);
    if (!type) return null;
    const cost = this.forgeCost(typeId);
    if (!this.spendFragments(cost)) return null;
    return this.pull(type, rng, true);
  }

  /** Pity count for a tier (pulls since the last pity-tier hit). */
  pityFor(typeId: string): number {
    return this.#_pity()[typeId] ?? 0;
  }

  /** Name of the guaranteed rarity for a tier. */
  pityLabel(type: SummonType): string {
    return type.pityRarity;
  }

  /** Species per rarity band (built lazily from the master list + details). */
  #bands = new Map<Rarity, string[]>();
  /** Species the player already owns (for the NEW! tag). */
  ownedSet = computed(() => new Set(this.#game.collection().keys()));

  /** Progress of the one-time band warmup (0..1). */
  #_warmProgress = signal(0);
  readonly warmProgress = this.#_warmProgress.asReadonly();
  #warming = false;
  #warmDone = false;

  get bandsReady(): boolean {
    return this.#warmDone;
  }

  #game = inject(Game);
  #data = inject(PokeData);
  #notify = inject(Notify);
  #storage = inject(BrowserStorage);

  constructor() {
    this.load();
  }

  /**
   * Warm the rarity bands in the background: fetch details (base XP) for the
   * save's generation and bucket every species by rarity. Runs a small worker
   * pool so the whole generation warms in a few seconds, once per session.
   */
  async warmBands(): Promise<void> {
    if (this.#warmDone || this.#warming) return;
    this.#warming = true;
    try {
      const names = this.#data.masterList().map((e) => e.name);
      const total = names.length;
      let done = 0;
      const queue = [...names];
      const workers = Array.from({ length: 6 }, async () => {
        while (queue.length > 0) {
          const name = queue.shift()!;
          const cached = this.#data.pokeByName(name);
          const d = cached ?? (await this.#data.fetchDetailParallel(name).catch(() => null));
          if (d) {
            const band = rarityFor(d.baseExperience);
            const list = this.#bands.get(band) ?? [];
            list.push(name);
            this.#bands.set(band, list);
          }
          done++;
          this.#_warmProgress.set(done / Math.max(1, total));
        }
      });
      await Promise.all(workers);
      this.#warmDone = true;
    } finally {
      this.#warming = false;
    }
  }

  /** Perform one pull on a summon tier (coins are spent here unless `free`). */
  pull(type: SummonType, rng: () => number = Math.random, free = false): PullResult | null {
    if (!this.bandsReady) {
      this.#notify.show('The portal is still warming up…');
      return null;
    }
    if (!free && !this.#game.spend(type.cost)) {
      this.#notify.show(`Not enough coins for the ${type.name} (${type.cost}¢).`);
      return null;
    }

    const pityCount = this.pityFor(type.id);
    const pityPull = pityCount >= type.pityEvery - 1;
    let rarity: Rarity;
    if (pityPull) {
      rarity = type.pityRarity;
      this.#_pity.update((p) => ({ ...p, [type.id]: 0 }));
    } else {
      rarity = this.rollRarity(type, rng);
      if (RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf(type.pityRarity)) {
        this.#_pity.update((p) => ({ ...p, [type.id]: 0 }));
      } else {
        this.#_pity.update((p) => ({ ...p, [type.id]: (p[type.id] ?? 0) + 1 }));
      }
    }
    this.persist();

    const name = this.pickFromBand(rarity);
    const newSpecies = !this.#game.own(name);
    this.#game.add(name, 1);
    this.#game.noteCatch();
    this.#data.registerNameId(name, this.#data.pokeByName(name)?.id ?? 0);
    return { name, rarity, level: 1, newSpecies, pity: pityPull };
  }

  /** Roll a rarity from a tier's rates. */
  rollRarity(type: SummonType, rng: () => number = Math.random): Rarity {
    const roll = rng();
    let acc = 0;
    for (const rarity of RARITY_ORDER) {
      acc += type.rates[rarity] ?? 0;
      if (roll < acc) return rarity;
    }
    return RARITY_ORDER[RARITY_ORDER.length - 1]!;
  }

  /** Random species from a rarity band (fallback: any cached species). */
  private pickFromBand(rarity: Rarity): string {
    const band = this.#bands.get(rarity) ?? [];
    if (band.length > 0) return band[Math.floor(Math.random() * band.length)]!;
    // Fallback: a random species from any band (shouldn't happen once warmed).
    const all = [...this.#bands.values()].flat();
    return all[Math.floor(Math.random() * all.length)] ?? this.#data.masterList()[0]?.name ?? '';
  }

  private load() {
    try {
      const raw = this.#storage.get(SUMMON_KEY);
      if (!raw) return;
      const s: SummonSave = JSON.parse(raw);
      this.#_pity.set({ basic: 0, advanced: 0, legendary: 0, ...(s.pity ?? {}) });
      this.#_fragments.set(Math.max(0, Math.floor(s.fragments ?? 0)));
    } catch {
      /* corrupted save — start fresh */
    }
  }

  private persist() {
    try {
      this.#storage.set(
        SUMMON_KEY,
        JSON.stringify({ pity: this.#_pity(), fragments: this.#_fragments() } satisfies SummonSave),
      );
    } catch {
      /* storage blocked — keep in memory */
    }
  }
}
