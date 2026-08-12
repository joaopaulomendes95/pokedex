import { computed, effect, signal, inject, Service } from '@angular/core';
import { LocationArea, PokeDetail, PokeId, PokeLocation } from '@poke/poke.model';
import { GenerationFilterService } from '@poke/generation-filter.service';
import { maxIdForGen } from '@poke/generation';
import type { PokemonListParams } from '@poke/poke-api/model/pokemonListParams';
import type { LocationAreaListParams } from '@poke/poke-api/model/locationAreaListParams';
import { pokemonListResource, pokemonRetrieveResource } from '@poke/poke-api/pokemon/pokemon.service';
import {
  locationAreaListResource,
  locationAreaRetrieveResource,
} from '@poke/poke-api/location/location.service';

/** How many creatures each dex page fetches (classic order). */
const DEX_LIMIT = 30;

/** Default dex page size. */
const DEFAULT_DEX_PAGE_SIZE = 30;

/** How many location maps each adventure page lists. */
const MAP_LIMIT = 10;

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
export class PokeDataService {
  private readonly genFilter = inject(GenerationFilterService);

  /** Changing this signal re-triggers the derived detail request. */
  readonly selected = signal<PokeId | null>(null);

  /** Which dex page the grid is on (offset = page * pageSize). */
  readonly dexPage = signal(0);

  /** Dex page size (user configurable). */
  readonly dexPageSize = signal(DEFAULT_DEX_PAGE_SIZE);

  /** Search query for global Pokémon search. */
  readonly searchQuery = signal('');

  /** Filtered Pokémon names based on search query (client-side filter). */
  readonly filteredPokemonNames = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.allPokemonNames();
    return this.allPokemonNames().filter((name) => name.toLowerCase().includes(query));
  });

  private readonly dexParams = computed<PokemonListParams>(() => ({
    limit: this.dexPageSize(),
    offset: this.dexPage() * this.dexPageSize(),
  }));

  private readonly dexResource = pokemonListResource(this.dexParams, {
    defaultValue: { count: 0, results: [] },
  });

  /** Fetch all Pokémon names once for global search (client-side filter). */
  private readonly allPokemonResource = pokemonListResource(
    computed<PokemonListParams>(() => ({ limit: 10000, offset: 0 })),
    { defaultValue: { count: 0, results: [] } },
  );

  /** All Pokémon names from PokeAPI (for global search). */
  readonly allPokemonNames = computed(
    () => this.allPokemonResource.value().results?.map((r) => r.name) ?? [],
  );

  /**
   * Search results across the WHOLE PokeAPI dex (name + url with a resolvable
   * pokédex ID), filtered client-side by `searchQuery`. Also populates
   * `nameToId` so sprites resolve for creatures outside the current dex page.
   */
  readonly searchResults = computed<PokeId[]>(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return [];
    const maxId = maxIdForGen(this.genFilter.maxGen());
    const out: PokeId[] = [];
    for (const e of this.allPokemonResource.value().results ?? []) {
      const id = Number(e.url.match(/\/(\d+)\/?$/)?.[1] ?? '0');
      if (id) this.nameToId.set(e.name, id);
      if (id > 0 && id <= maxId && e.name.toLowerCase().includes(query)) {
        out.push({ name: e.name, url: e.url });
      }
    }
    return out;
  });

  /** True while the full-list (the search source) is still loading. */
  readonly searchLoading = computed(
    () => this.searchQuery().trim().length > 0 && this.allPokemonResource.isLoading(),
  );

  private readonly detailName = computed<string>(() => this.selected()?.name ?? '');

  private readonly detailResource = pokemonRetrieveResource(this.detailName, {
    request: (request) =>
      this.shouldFetchDetail() ? request : (undefined as unknown as typeof request),
  });

  /** name → detail; the rendered dex hands over from the cache instantly. */
  private readonly detailCache = new Map<string, PokeDetail>();

  /** name → pokédex ID (populated from any list fetch, independent of filters/pages). */
  private readonly nameToId = new Map<string, number>();

  /** name → real location-areas where the species was seen while exploring. */
  private readonly discoveredHabitats = new Map<string, PokeLocation[]>();

  /** The dex page the game reads from (current page only, filtered by generation). */
  readonly dex = computed<PokeId[]>(() => {
    const maxId = maxIdForGen(this.genFilter.maxGen());
    const entries: PokeId[] = [];
    for (const e of this.dexResource.value().results ?? []) {
      const id = Number(e.url.match(/\/(\d+)\/?$/)?.[1] ?? '0');
      if (id) this.nameToId.set(e.name, id);
      // Keep only creatures that belong to the allowed generations.
      if (id <= maxId) entries.push({ name: e.name, url: e.url });
    }
    return entries;
  });

  readonly dexLoading = computed(() => this.dexResource.isLoading());
  readonly dexError = computed(() => this.dexResource.error());

  /** Total creatures in the PokeAPI dex (drives pagination bounds). */
  readonly dexTotal = computed(() => {
    const maxGen = this.genFilter.maxGen();
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
    this.dexPage.update((p) => (p < this.dexMaxPage() ? p + 1 : p));
  }

  prevDexPage() {
    this.dexPage.update((p) => (p > 0 ? p - 1 : p));
  }

  /** Go to first page. */
  firstDexPage() {
    this.dexPage.set(0);
  }

  /** Go to last page. */
  lastDexPage() {
    this.dexPage.set(this.dexMaxPage());
  }

  /** Go to specific page (clamped). */
  goToDexPage(page: number) {
    this.dexPage.set(Math.max(0, Math.min(page, this.dexMaxPage())));
  }

  /** Change page size and reset to first page. */
  setDexPageSize(size: number) {
    this.dexPageSize.set(size);
    this.dexPage.set(0);
  }

  /** Which map page the adventure is browsing (offset = page * MAP_LIMIT). */
  readonly mapPage = signal(0);

  /** The location-area currently being explored. */
  readonly exploring = signal<PokeLocation | null>(null);

  private readonly mapParams = computed<LocationAreaListParams>(() => ({
    limit: MAP_LIMIT,
    offset: this.mapPage() * MAP_LIMIT,
  }));

  private readonly mapResource = locationAreaListResource(this.mapParams, {
    defaultValue: { count: 0, results: [] },
  });

  private readonly areaId = computed<number>(() => {
    const loc = this.exploring();
    const id = Number(loc?.url.match(/\/(\d+)\/?$/)?.[1] ?? '0');
    return Number.isFinite(id) ? id : 0;
  });

  private readonly areaResource = locationAreaRetrieveResource(this.areaId, {
    request: (resource) =>
      this.exploring() ? resource : (undefined as unknown as typeof resource),
  });

  readonly locations = computed(() => this.mapResource.value().results ?? []);

  /** Locations filtered to only those that have at least one encounter in the allowed generation. */
  readonly filteredLocations = computed(() => {
    return this.locations();
  });

  readonly locationsLoading = computed(() => this.mapResource.isLoading());
  readonly locationsError = computed(() => this.mapResource.error());

  readonly mapTotal = computed(() => this.mapResource.value().count ?? 0);
  readonly mapMaxPage = computed(() => Math.max(0, Math.ceil(this.mapTotal() / MAP_LIMIT) - 1));
  readonly hasPrevMapPage = computed(() => this.mapPage() > 0);
  readonly hasNextMapPage = computed(() => this.mapPage() < this.mapMaxPage());

  readonly exploringArea = computed(() => this.exploring());

  /** Encounters in the current area, filtered by generation. */
  readonly areaEncounters = computed(() => {
    const area = this.area();
    if (!area) return [];
    const maxId = maxIdForGen(this.genFilter.maxGen());
    return area.pokemon_encounters.filter((enc) => {
      const id = Number(enc.pokemon.url.match(/\/(\d+)\/?$/)?.[1] ?? '0');
      return id <= maxId;
    });
  });

  readonly area = computed<LocationArea | null>(() => {
    const raw = this.areaResource.value();
    return raw ? parseArea(raw as never) : null;
  });
  readonly areaLoading = computed(() => this.areaResource.isLoading());
  readonly areaError = computed(() => this.areaResource.error());

  nextMapPage() {
    this.mapPage.update((p) => (p < this.mapMaxPage() ? p + 1 : p));
  }

  prevMapPage() {
    this.mapPage.update((p) => (p > 0 ? p - 1 : p));
  }

  /** Go to first map page. */
  firstMapPage() {
    this.mapPage.set(0);
  }

  /** Go to last map page. */
  lastMapPage() {
    this.mapPage.set(this.mapMaxPage());
  }

  /** Begin exploring an area — its wild spawns appear in `area()`. */
  explore(loc: PokeLocation) {
    this.exploring.set(loc);
  }

  leaveArea() {
    this.exploring.set(null);
  }

  retryArea() {
    this.areaResource.reload();
  }

  /** Detail for `selected()`: cache first, network value otherwise. */
  readonly detail = computed<PokeDetail | null>(() => {
    const sel = this.selected();
    if (!sel) return null;
    const cached = this.detailCache.get(sel.name);
    if (cached) return cached;
    const raw = this.detailResource.value();
    return raw ? parseDetail(raw as never) : null;
  });
  readonly detailLoading = computed(() => this.detailResource.isLoading());
  readonly detailError = computed(() => this.detailResource.error());

  constructor() {
    // Harvest every successful detail into memory for later taps.
    effect(() => {
      const raw = this.detailResource.value();
      if (raw) {
        const d = parseDetail(raw as never);
        this.detailCache.set(d.name, d);
        this.nameToId.set(d.name, d.id);
      }
    });
    // Also harvest name→id from area encounters when explored, and remember
    // which real location-areas each species was encountered in.
    effect(() => {
      const area = this.areaResource.value();
      if (area) {
        const loc = this.exploring();
        for (const enc of area.pokemon_encounters ?? []) {
          const id = Number(enc.pokemon.url.match(/\/(\d+)\/?$/)?.[1] ?? '0');
          if (id) this.nameToId.set(enc.pokemon.name, id);
          if (loc) {
            const seen = this.discoveredHabitats.get(enc.pokemon.name) ?? [];
            if (!seen.some((l) => l.url === loc.url)) {
              seen.push(loc);
              this.discoveredHabitats.set(enc.pokemon.name, seen);
            }
          }
        }
      }
    });
    // Reset dex page when generation filter changes.
    effect(() => {
      this.genFilter.maxGen();
      this.dexPage.set(0);
    });
  }

  select(entry: PokeId) {
    this.selected.set(entry);
  }

  /** Clear whatever is selected (used after dialogs close). */
  clearSelection(): void {
    this.selected.set(null);
  }

  /** Selects a creature by name only (squad collection cards). */
  selectByName(name: string) {
    this.selected.set(this.selected()?.name === name ? this.selected()! : { name, url: '' });
  }

  /** Reads a cached detail (no request if it hasn't been fetched yet). */
  pokeByName(name: string): PokeDetail | null {
    return this.detailCache.get(name) ?? null;
  }

  /** Real location-areas (with URLs) where the player has seen this species. */
  habitatsFor(name: string): PokeLocation[] {
    return this.discoveredHabitats.get(name.toLowerCase()) ?? [];
  }

  /**
   * Ensures we have the pokédex ID for a name (for sprites). Called when owning/catching.
   */
  registerNameId(name: string, id: number) {
    if (id) this.nameToId.set(name, id);
  }

  /**
   * Sprite URL straight from the pokédex ID (works regardless of filters/pages).
   */
  spriteUrl(name: string): string {
    const id = this.nameToId.get(name);
    if (id) {
      return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
    }
    return '';
  }

  /** Sprite from the cached detail first (covers names outside the dex). */
  spriteUrlOrEmpty(name: string): string {
    const cached = this.detailCache.get(name);
    if (cached?.spriteUrl) return cached.spriteUrl;
    return this.spriteUrl(name);
  }

  retryDex() {
    this.dexResource.reload();
  }

  retryDetail() {
    this.detailResource.reload();
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
      if (this.detailCache.has(name)) continue;
      this.selected.set({ name, url: '' });
      await waitFor(() => this.detailCache.has(name), timeoutMs);
    }
  }

  /** Cannot fetch when nothing is selected or the entry is already cached. */
  private shouldFetchDetail(): boolean {
    const sel = this.selected();
    return Boolean(sel && !this.detailCache.has(sel.name));
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

/** Exported for unit tests — maps a raw PokeAPI body to our PokeDetail. */
export function parseDetail(raw: unknown): PokeDetail {
  const r = raw as any;
  return {
    id: r.id,
    name: r.name,
    types: (r.types ?? []).map((t: any) => t.type?.name).filter(Boolean),
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

function stat(raw: any, name: string): number {
  const hit = (raw?.stats ?? []).find((s: any) => s.stat?.name === name);
  return hit?.base_stat ?? 0;
}

/** Exported for unit tests — maps a raw `/location-area` body to our type. */
export function parseArea(raw: unknown): LocationArea {
  const r = raw as any;
  return {
    name: r.name ?? '',
    pokemon_encounters: (r.pokemon_encounters ?? []).map((enc: any) => ({
      pokemon: enc?.pokemon ?? { name: '', url: '' },
    })),
  };
}
