import { computed, effect, inject, linkedSignal, signal, Service } from '@angular/core';
import { LocationArea, PokeDetail, PokeId, PokeLocation } from '@poke/poke.model';
import { GenerationFilter } from '@poke/generation-filter';
import { maxIdForGen } from '@poke/generation';
import type { PokemonListParams } from '@shared/openapi/poke-api/model/pokemonListParams';
import {
  pokemonListResource,
  pokemonRetrieveResource,
} from '@shared/openapi/poke-api/pokemon/pokemon.service';
import { locationAreaRetrieveResource } from '@shared/openapi/poke-api/location/location.service';

/** Default dex page size. */
const DEFAULT_DEX_PAGE_SIZE = 30;

// PokeAPI base — no key, CORS-open, used over HTTPS.
const BASE_URL = 'https://pokeapi.co/api/v2';

/**
 * Player-facing data service, powered by the Orval-generated PokeAPI client.
 *
 * Three patterns (list / detail / location-area) all come from generated
 * `*Resource` functions backed by `httpResource`:
 *
 *  1. The dex and the location map are signal-driven list requests.
 *  2. The detail + explored-area requests are SIGAL-derived; changing
 *     `selected()`/`exploring()` re-triggers them.
 *
 * The in-memory cache keeps flipping through the dex from repeating network
 * calls: whenever the selected name is already cached we return `undefined`
 * from the generated resource's `request` hook, which keeps it Idle.
 */
@Service()
export class PokeData {
  #genFilter = inject(GenerationFilter);

  /** Changing this signal re-triggers the derived detail request. */
  #_selected = signal<PokeId | null>(null);
  readonly selected = this.#_selected.asReadonly();

  /** Which dex page the grid is on (offset = page * pageSize). Reset when the generation filter changes. */
  #_dexPage = linkedSignal({
    source: () => this.#genFilter.maxGen(),
    computation: () => 0,
  });
  readonly dexPage = this.#_dexPage.asReadonly();

  /** Dex page size (user configurable). */
  #_dexPageSize = signal(DEFAULT_DEX_PAGE_SIZE);
  readonly dexPageSize = this.#_dexPageSize.asReadonly();

  /** Search query for global Pokémon search. */
  #_searchQuery = signal('');
  readonly searchQuery = this.#_searchQuery.asReadonly();

  #dexParams = computed<PokemonListParams>(() => ({
    limit: this.dexPageSize(),
    offset: this.dexPage() * this.dexPageSize(),
  }));

  #dexResource = pokemonListResource(this.#dexParams, {
    defaultValue: { count: 0, results: [] },
  });

  /** Fetch all Pokémon names once for global search (client-side filter). */
  #allPokemonResource = pokemonListResource(
    computed<PokemonListParams>(() => ({ limit: 10000, offset: 0 })),
    { defaultValue: { count: 0, results: [] } },
  );

  /**
   * Search results across the WHOLE PokeAPI dex (name + url with a resolvable
   * pokédex ID), filtered client-side by `searchQuery`.
   */
  readonly searchResults = computed<PokeId[]>(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return [];
    const maxId = maxIdForGen(this.#genFilter.maxGen());
    const out: PokeId[] = [];
    for (const e of this.#allPokemonResource.value().results ?? []) {
      const id = Number(e.url.match(/\/(\d+)\/?$/)?.[1] ?? '0');
      if (id > 0 && id <= maxId && e.name.toLowerCase().includes(query)) {
        out.push({ name: e.name, url: e.url });
      }
    }
    return out;
  });

  /** True while the full-list (the search source) is still loading. */
  readonly searchLoading = computed(
    () => this.searchQuery().trim().length > 0 && this.#allPokemonResource.isLoading(),
  );

  #detailName = computed<string>(() => this.selected()?.name ?? '');

  #detailResource = pokemonRetrieveResource(this.#detailName, {
    request: (request) =>
      this.shouldFetchDetail() ? request : (undefined as unknown as typeof request),
  });

  /** name → detail; the rendered dex hands over from the cache instantly. */
  #detailCache = new Map<string, PokeDetail>();

  /** name → pokédex ID (populated from any list fetch, independent of filters/pages). */
  #nameToId = new Map<string, number>();

  /** name → real location-areas where the species was seen while exploring. */
  #discoveredHabitats = new Map<string, PokeLocation[]>();

  /** The dex page the game reads from (current page only, filtered by generation). */
  readonly dex = computed<PokeId[]>(() => {
    const maxId = maxIdForGen(this.#genFilter.maxGen());
    const entries: PokeId[] = [];
    for (const e of this.#dexResource.value().results ?? []) {
      const id = Number(e.url.match(/\/(\d+)\/?$/)?.[1] ?? '0');
      // Keep only creatures that belong to the allowed generations.
      if (id <= maxId) entries.push({ name: e.name, url: e.url });
    }
    return entries;
  });

  readonly dexLoading = computed(() => this.#dexResource.isLoading());
  readonly dexError = computed(() => this.#dexResource.error());

  /** Total creatures in the PokeAPI dex (drives pagination bounds). */
  readonly dexTotal = computed(() => {
    const maxGen = this.#genFilter.maxGen();
    if (maxGen >= 9) return 1025; // all gens
    return maxIdForGen(maxGen); // last ID of that generation = total count
  });
  readonly dexMaxPage = computed(() =>
    Math.max(0, Math.ceil(this.dexTotal() / this.dexPageSize()) - 1),
  );
  readonly hasPrevPage = computed(() => this.dexPage() > 0);
  readonly hasNextPage = computed(() => this.dexPage() < this.dexMaxPage());

  /** Move the dex to the given page (clamped) — page replaces the current one. */
  nextDexPage() {
    this.#_dexPage.update((p) => (p < this.dexMaxPage() ? p + 1 : p));
  }

  prevDexPage() {
    this.#_dexPage.update((p) => (p > 0 ? p - 1 : p));
  }

  /** Go to first page. */
  firstDexPage() {
    this.#_dexPage.set(0);
  }

  /** Go to last page. */
  lastDexPage() {
    this.#_dexPage.set(this.dexMaxPage());
  }

  /** Go to specific page (clamped). */
  goToDexPage(page: number) {
    this.#_dexPage.set(Math.max(0, Math.min(page, this.dexMaxPage())));
  }

  /** Change page size and reset to first page. */
  setDexPageSize(size: number) {
    this.#_dexPageSize.set(size);
    this.#_dexPage.set(0);
  }

  /** Update the global Pokémon search query (from the dex search box). */
  setSearchQuery(query: string) {
    this.#_searchQuery.set(query);
  }

  /** The location-area currently being explored. */
  #_exploring = signal<PokeLocation | null>(null);
  readonly exploring = this.#_exploring.asReadonly();

  #areaId = computed<number>(() => {
    const loc = this.exploring();
    const id = Number(loc?.url.match(/\/(\d+)\/?$/)?.[1] ?? '0');
    return Number.isFinite(id) ? id : 0;
  });

  #areaResource = locationAreaRetrieveResource(this.#areaId, {
    request: (resource) =>
      this.exploring() ? resource : (undefined as unknown as typeof resource),
  });

  readonly exploringArea = computed(() => this.exploring());

  /** Encounters in the current area, filtered by generation. */
  readonly areaEncounters = computed(() => {
    const area = this.area();
    if (!area) return [];
    const maxId = maxIdForGen(this.#genFilter.maxGen());
    return area.pokemon_encounters.filter((enc) => {
      const id = Number(enc.pokemon.url.match(/\/(\d+)\/?$/)?.[1] ?? '0');
      return id <= maxId;
    });
  });

  readonly area = computed<LocationArea | null>(() => {
    const raw = this.#areaResource.value();
    return raw ? parseArea(raw) : null;
  });
  readonly areaLoading = computed(() => this.#areaResource.isLoading());
  readonly areaError = computed(() => this.#areaResource.error());

  /** Begin exploring an area — its wild spawns appear in `area()`. */
  explore(loc: PokeLocation) {
    this.#_exploring.set(loc);
  }

  leaveArea() {
    this.#_exploring.set(null);
  }

  retryArea() {
    this.#areaResource.reload();
  }

  /** Detail for `selected()`: cache first, network value otherwise. */
  readonly detail = computed<PokeDetail | null>(() => {
    const sel = this.selected();
    if (!sel) return null;
    const cached = this.#detailCache.get(sel.name);
    if (cached) return cached;
    const raw = this.#detailResource.value();
    return raw ? parseDetail(raw) : null;
  });
  readonly detailLoading = computed(() => this.#detailResource.isLoading());
  readonly detailError = computed(() => this.#detailResource.error());

  constructor() {
    // Populate name→ID from every list fetch so sprite URLs resolve without
    // depending on the current page/filters (kept out of the computeds so they
    // stay pure).
    effect(() => {
      for (const e of this.#dexResource.value().results ?? []) {
        const id = Number(e.url.match(/\/(\d+)\/?$/)?.[1] ?? '0');
        if (id) this.#nameToId.set(e.name, id);
      }
      for (const e of this.#allPokemonResource.value().results ?? []) {
        const id = Number(e.url.match(/\/(\d+)\/?$/)?.[1] ?? '0');
        if (id) this.#nameToId.set(e.name, id);
      }
    });
    // Harvest every successful detail into memory for later taps.
    effect(() => {
      const raw = this.#detailResource.value();
      if (raw) {
        const d = parseDetail(raw);
        this.#detailCache.set(d.name, d);
        this.#nameToId.set(d.name, d.id);
      }
    });
    // Also harvest name→id from area encounters when explored, and remember
    // which real location-areas each species was encountered in.
    effect(() => {
      const area = this.#areaResource.value();
      if (area) {
        const loc = this.exploring();
        for (const enc of area.pokemon_encounters ?? []) {
          const id = Number(enc.pokemon.url.match(/\/(\d+)\/?$/)?.[1] ?? '0');
          if (id) this.#nameToId.set(enc.pokemon.name, id);
          if (loc) {
            const seen = this.#discoveredHabitats.get(enc.pokemon.name) ?? [];
            if (!seen.some((l) => l.url === loc.url)) {
              seen.push(loc);
              this.#discoveredHabitats.set(enc.pokemon.name, seen);
            }
          }
        }
      }
    });
  }
  select(entry: PokeId) {
    this.#_selected.set(entry);
  }

  /** Clear whatever is selected (used after dialogs close). */
  clearSelection(): void {
    this.#_selected.set(null);
  }

  /** Selects a creature by name only (squad collection cards). */
  selectByName(name: string) {
    this.#_selected.set(this.selected()?.name === name ? this.selected()! : { name, url: '' });
  }

  /** Reads a cached detail (no request if it hasn't been fetched yet). */
  pokeByName(name: string): PokeDetail | null {
    return this.#detailCache.get(name) ?? null;
  }

  /** Real location-areas (with URLs) where the player has seen this species. */
  habitatsFor(name: string): PokeLocation[] {
    return this.#discoveredHabitats.get(name.toLowerCase()) ?? [];
  }

  /**
   * Ensures we have the pokédex ID for a name (for sprites). Called when owning/catching.
   */
  registerNameId(name: string, id: number) {
    if (id) this.#nameToId.set(name, id);
  }

  /**
   * Sprite URL straight from the pokédex ID (works regardless of filters/pages).
   */
  spriteUrl(name: string): string {
    const id = this.#nameToId.get(name);
    if (id) {
      return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
    }
    return '';
  }

  /** Sprite from the cached detail first (covers names outside the dex). */
  spriteUrlOrEmpty(name: string): string {
    const cached = this.#detailCache.get(name);
    if (cached?.spriteUrl) return cached.spriteUrl;
    return this.spriteUrl(name);
  }

  retryDex() {
    this.#dexResource.reload();
  }

  retryDetail() {
    this.#detailResource.reload();
  }

  /** Details for default squad is warmed up before the arena needs stats. */
  warmup(): Promise<void> {
    return this.ensureInCache(['bulbasaur', 'charmander', 'squirtle']);
  }

  /**
   * Guarantees the detail for a list of names is in memory. Pulls them one at
   * a time by toggling `selected` and waiting for the cache — the arena needs
   * every fighter's stats on hand before it can roll the sim.
   */
  async ensureInCache(names: string[], timeoutMs = 3000): Promise<void> {
    for (const name of names) {
      if (this.#detailCache.has(name)) continue;
      this.#_selected.set({ name, url: '' });
      await waitFor(() => this.#detailCache.has(name), timeoutMs);
    }
  }

  /** Cannot fetch when nothing is selected or the entry is already cached. */
  private shouldFetchDetail(): boolean {
    const sel = this.selected();
    return Boolean(sel && !this.#detailCache.has(sel.name));
  }
}

/** Resolves when `predicate` becomes truthy (checked every 30ms). */
function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const id = setInterval(() => {
      if (predicate()) {
        clearInterval(id);
        resolve();
      } else if (Date.now() > deadline) {
        clearInterval(id);
        reject(new Error('timed out waiting for poke detail'));
      }
    }, 30);
  });
}

interface RawStatSlot {
  stat?: { name?: string } | null;
  base_stat?: number;
}
interface RawTypeSlot {
  type?: { name?: string } | null;
}
interface RawSprites {
  front_default?: string;
  other?: { 'official-artwork'?: { front_default?: string } };
}
interface RawDetail {
  id?: number;
  name?: string;
  types?: RawTypeSlot[];
  stats?: RawStatSlot[];
  sprites?: RawSprites;
  base_experience?: number;
}
interface RawEncounter {
  pokemon?: { name?: string; url?: string };
}
interface RawArea {
  name?: string;
  pokemon_encounters?: RawEncounter[];
}

/** Exported for unit tests — maps a raw PokeAPI body to our PokeDetail. */
export function parseDetail(raw: unknown): PokeDetail {
  const r = raw as RawDetail;
  return {
    id: r.id ?? 0,
    name: r.name ?? '',
    types: (r.types ?? []).map((t) => t.type?.name ?? '').filter(Boolean),
    stats: {
      hp: stat(r, 'hp'),
      attack: stat(r, 'attack'),
      defense: stat(r, 'defense'),
      spAtk: stat(r, 'special-attack'),
      spDef: stat(r, 'special-defense'),
      speed: stat(r, 'speed'),
    },
    spriteUrl: r.sprites?.front_default ?? '',
    artworkUrl: r.sprites?.other?.['official-artwork']?.front_default ?? '',
    baseExperience: r.base_experience ?? 0,
  };
}

function stat(raw: RawDetail, name: string): number {
  const hit = (raw.stats ?? []).find((s) => s.stat?.name === name);
  return hit?.base_stat ?? 0;
}

/** Exported for unit tests — maps a raw `/location-area` body to our type. */
export function parseArea(raw: unknown): LocationArea {
  const r = raw as RawArea;
  return {
    name: r.name ?? '',
    pokemon_encounters: (r.pokemon_encounters ?? []).map((enc) => ({
      pokemon: { name: enc.pokemon?.name ?? '', url: enc.pokemon?.url ?? '' },
    })),
  };
}
