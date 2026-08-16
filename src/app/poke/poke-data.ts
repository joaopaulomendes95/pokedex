import { computed, effect, inject, linkedSignal, signal, Service } from '@angular/core';
import { LocationArea, PokeDetail, PokeId, PokeLocation, FighterMove } from '@poke/poke.model';
import { GenerationFilter } from '@poke/generation-filter';
import { maxIdForGen } from '@poke/generation';
import type { PokemonListParams } from '@shared/openapi/poke-api/model/pokemonListParams';
import {
  pokemonListResource,
  pokemonRetrieveResource,
  pokemonSpeciesRetrieveResource,
  abilityRetrieveResource,
} from '@shared/openapi/poke-api/pokemon/pokemon.service';
import { moveRetrieveResource } from '@shared/openapi/poke-api/moves/moves.service';
import { evolutionChainRetrieveResource } from '@shared/openapi/poke-api/evolution/evolution.service';
import { locationAreaRetrieveResource } from '@shared/openapi/poke-api/location/location.service';

/** Default dex page size. */
const DEFAULT_DEX_PAGE_SIZE = 30;

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

  /** Fetch all Pokémon names once for global search (client-side filter). */
  #masterParams = computed<PokemonListParams>(() => ({
    limit: maxIdForGen(this.#genFilter.maxGen()),
    offset: 0,
  }));

  /**
   * The ONE list fetch per save: every Pokémon up to the save's generation
   * (`maxGen`). Everything the player interacts with — dex pages, search,
   * adventure wild pools, arena rivals — is derived from this read-only
   * master list, so no higher-generation species can ever leak in.
   */
  #masterResource = pokemonListResource(this.#masterParams, {
    defaultValue: { count: 0, results: [] },
  });

  /** Read-only master list: every Pokémon up to the save's generation. */
  readonly masterList = computed<PokeId[]>(() => {
    const maxId = maxIdForGen(this.#genFilter.maxGen());
    const out: PokeId[] = [];
    for (const e of this.#masterResource.value().results ?? []) {
      const id = Number(e.url.match(/\/(\d+)\/?$/)?.[1] ?? '0');
      // Belt-and-braces: even a stale in-flight response can't leak a species
      // above the save's generation.
      if (id > 0 && id <= maxId) out.push({ name: e.name, url: e.url });
    }
    return out;
  });

  /** Fast lowercase name→membership check against the master list. */
  readonly masterNames = computed(() => new Set(this.masterList().map((e) => e.name)));

  /** Whether a species belongs to the save's generation (rival/pool gating). */
  isInMasterList(name: string): boolean {
    return this.masterNames().has(name.toLowerCase());
  }

  readonly masterLoading = computed(() => this.#masterResource.isLoading());
  readonly masterError = computed(() => this.#masterResource.error());

  /**
   * Search results across the master list, filtered client-side by
   * `searchQuery` (no species above the save's generation can appear).
   */
  readonly searchResults = computed<PokeId[]>(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return [];
    return this.masterList().filter((e) => e.name.includes(query));
  });

  /** True while the master list (the search source) is still loading. */
  readonly searchLoading = computed(
    () => this.searchQuery().trim().length > 0 && this.masterLoading(),
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

  /** The move currently being fetched by the derived move resource. */
  #_moveName = signal('');

  #moveResource = moveRetrieveResource(this.#_moveName, {
    request: (request) =>
      this.shouldFetchMove() ? request : (undefined as unknown as typeof request),
  });

  /** name → real move (type/category/power) from `/move/:name`. */
  #moveCache = new Map<string, FighterMove>();

  /** The species currently being fetched for its dex entry. */
  #_speciesName = signal('');

  #speciesResource = pokemonSpeciesRetrieveResource(this.#_speciesName, {
    request: (request) =>
      this.shouldFetchSpecies() ? request : (undefined as unknown as typeof request),
  });

  /** name → English Pokédex entry (flavor text) from `/pokemon-species/:name`. */
  #speciesCache = new Map<string, string>();

  /** name → the species it evolves FROM (null = base form), from the species body. */
  #evolvesFromCache = new Map<string, string | null>();

  /** The ability currently being fetched for its effect text. */
  #_abilityName = signal('');

  #abilityResource = abilityRetrieveResource(this.#_abilityName, {
    request: (request) =>
      this.#_abilityName() ? request : (undefined as unknown as typeof request),
  });

  /** ability name → English short effect text from `/ability/:name`. */
  #abilityCache = new Map<string, string>();

  /** species name → evolution-chain ID (harvested from the species body). */
  #chainIdByName = new Map<string, string>();

  /** The chain currently being fetched (its numeric id as a string). */
  #_chainId = signal('');

  #chainResource = evolutionChainRetrieveResource(this.#_chainId, {
    request: (request) =>
      this.shouldFetchChain() ? request : (undefined as unknown as typeof request),
  });

  /** chain id → flattened evolution steps (dedupe for the request gate). */
  #chainById = new Map<string, EvoStep[]>();

  /** species name → flattened evolution steps from `/evolution-chain/:id`. */
  #chainCache = new Map<string, EvoStep[]>();

  /**
   * The dex page the game reads from: a slice of the master list (no
   * per-page network calls — one list fetch per save).
   */
  readonly dex = computed<PokeId[]>(() => {
    const all = this.masterList();
    const start = this.dexPage() * this.dexPageSize();
    return all.slice(start, start + this.dexPageSize());
  });

  readonly dexLoading = computed(() => this.masterLoading());
  readonly dexError = computed(() => this.masterError());

  /** Total creatures in the save's generation (drives pagination bounds). */
  readonly dexTotal = computed(() => this.masterList().length);
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
    // mat-select emits strings when options are declared with value="N" —
    // coerce so `limit`/`offset` stay numbers for the PokeAPI request.
    const n = Math.max(1, Math.min(1000, Number(size) || DEFAULT_DEX_PAGE_SIZE));
    this.#_dexPageSize.set(n);
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

  /** The location-area currently being fetched for the wild-zone pool. */
  #_poolAreaUrl = signal('');

  #poolAreaId = computed(() => {
    const m = this.#_poolAreaUrl().match(/(\d+)\/?$/);
    return m ? Number(m[1]) : 0;
  });

  #poolResource = locationAreaRetrieveResource(this.#poolAreaId, {
    request: (request) =>
      this.#_poolAreaUrl() ? request : (undefined as unknown as typeof request),
  });

  /** url → parsed location-area (all fetched areas, explore + pool). */
  #areaDataCache = new Map<string, LocationArea>();

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
      for (const e of this.#masterResource.value().results ?? []) {
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
    // Harvest every fetched move into memory (guarded against stale values).
    effect(() => {
      const raw = this.#moveResource.value();
      const name = this.#_moveName();
      if (raw && name && name === this.#_moveName()) {
        this.#moveCache.set(name, parseMove(raw, name));
      }
    });
    // Harvest every fetched species entry (guarded against stale values).
    effect(() => {
      const raw = this.#speciesResource.value();
      const name = this.#_speciesName();
      if (raw && name && name === this.#_speciesName()) {
        const flavor = parseFlavor(raw);
        if (flavor) this.#speciesCache.set(name, flavor);
        // The generated resource builds `evolution-chain/${id}/` — it needs the
        // numeric chain ID, not the URL the species body hands back.
        const chainId = chainIdFromUrl(parseChainUrl(raw));
        if (chainId) this.#chainIdByName.set(name, chainId);
        this.#evolvesFromCache.set(name, parseEvolvesFrom(raw));
      }
    });
    // Harvest every fetched ability (guarded against stale values).
    effect(() => {
      const raw = this.#abilityResource.value();
      const name = this.#_abilityName();
      if (raw && name && name === this.#_abilityName()) {
        const effect = parseAbilityEffect(raw);
        if (effect) this.#abilityCache.set(name, effect);
      }
    });
    // Harvest every fetched evolution chain into memory.
    effect(() => {
      const raw = this.#chainResource.value();
      const id = this.#_chainId();
      if (raw && id && id === this.#_chainId()) {
        const steps = parseChain(raw);
        this.#chainById.set(id, steps);
        // Map the flattened steps back to every species mentioned in the chain.
        for (const species of speciesInChain(raw)) {
          this.#chainCache.set(species, steps);
        }
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
    // Harvest every zone-pool area fetch into the shared area cache.
    effect(() => {
      const raw = this.#poolResource.value();
      const url = this.#_poolAreaUrl();
      if (raw && url && url === this.#_poolAreaUrl()) {
        this.#areaDataCache.set(url, parseArea(raw));
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

  /**
   * Fetches a zone's areas and returns a shuffled, deduped wild pool of
   * species (era-capped). Details are warmed so sprites + fights are instant.
   */
  async zonePool(areaUrls: string[], genCap: number, poolSize = 8): Promise<PokeId[]> {
    for (const url of areaUrls) {
      if (this.#areaDataCache.has(url)) continue;
      this.#_poolAreaUrl.set(url);
      await waitFor(() => this.#areaDataCache.has(url), 5000);
    }
    const areas = areaUrls
      .map((url) => this.#areaDataCache.get(url))
      .filter((a): a is LocationArea => Boolean(a));
    // The wild pool never exceeds the save's generation: cap the zone era by
    // maxGen AND drop anything missing from the master list.
    const cap = Math.min(genCap, this.#genFilter.maxGen());
    const pool = buildZonePool(areas, cap)
      .filter((p) => this.masterNames().has(p.name))
      .slice(0, poolSize);
    void this.ensureInCache(pool.map((p) => p.name)).catch(() => undefined);
    return pool;
  }

  /** Reads a cached detail (no request if it hasn't been fetched yet). */
  pokeByName(name: string): PokeDetail | null {
    return this.#detailCache.get(name) ?? null;
  }

  /** Reads a cached real move (no request if it hasn't been fetched yet). */
  moveByName(name: string): FighterMove | null {
    return this.#moveCache.get(name) ?? null;
  }

  /**
   * The battle moveset for a pokémon: resolves its cached detail's real
   * moves against the move cache. Empty until both are warmed.
   */
  movesFor(name: string): FighterMove[] {
    const detail = this.#detailCache.get(name);
    if (!detail) return [];
    const out: FighterMove[] = [];
    for (const m of detail.moves) {
      const move = this.#moveCache.get(m.name);
      if (move) out.push(move);
    }
    return out;
  }

  /** The English Pokédex entry for a species (cached, no request if absent). */
  speciesFlavor(name: string): string | null {
    return this.#speciesCache.get(name) ?? null;
  }

  /**
   * The species this one evolves FROM (`null` = base form, `undefined` =
   * species body not fetched yet). Drives the "first evolutions only" wild
   * filter and the evolution UI.
   */
  evolvesFrom(name: string): string | null | undefined {
    return this.#evolvesFromCache.has(name) ? this.#evolvesFromCache.get(name)! : undefined;
  }

  /** English short effect text for an ability (cached, no request if absent). */
  abilityEffect(name: string): string | null {
    return this.#abilityCache.get(name) ?? null;
  }

  /** Flattened evolution steps for a species (cached, empty until warmed). */
  evolutionFor(name: string): EvoStep[] {
    return this.#chainCache.get(name) ?? [];
  }

  /**
   * True when the species' chain is known AND has no evolution edges at all
   * (a single-stage pokémon like Lapras — it can never evolve).
   */
  isApex(name: string): boolean {
    return this.#chainIdByName.has(name) && this.evolutionFor(name).length === 0;
  }

  /**
   * True when the species is the LAST stage of a real chain (evolved into,
   * but nothing evolves from it — e.g. Charizard). Unknown until warmed.
   */
  isFinalForm(name: string): boolean {
    const steps = this.evolutionFor(name);
    return steps.length > 0 && !steps.some((s) => s.species === name);
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

  /** Shiny sprite for a name (works once the dex ID is known). */
  shinySpriteUrl(name: string): string {
    const id = this.#nameToId.get(name) ?? this.#detailCache.get(name)?.id ?? 0;
    if (id) {
      return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${id}.png`;
    }
    return this.spriteUrlOrEmpty(name);
  }

  retryDex() {
    this.#masterResource.reload();
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

  /**
   * Guarantees the real move details for every move in the given pokémon's
   * movesets are cached (details must already be in memory — call
   * `ensureInCache` first).
   */
  async ensureMoves(pokeNames: string[], timeoutMs = 5000): Promise<void> {
    for (const pokeName of pokeNames) {
      const detail = this.#detailCache.get(pokeName);
      if (!detail) continue;
      for (const m of detail.moves) {
        if (this.#moveCache.has(m.name)) continue;
        this.#_moveName.set(m.name);
        await waitFor(() => this.#moveCache.has(m.name), timeoutMs);
      }
    }
  }

  /** Guarantees the dex entry for a list of species names is cached. */
  async ensureSpecies(pokeNames: string[], timeoutMs = 5000): Promise<void> {
    for (const name of pokeNames) {
      if (this.#speciesCache.has(name)) continue;
      this.#_speciesName.set(name);
      await waitFor(() => this.#speciesCache.has(name), timeoutMs);
    }
  }

  /** Guarantees the effect text for a list of ability names is cached. */
  async ensureAbilities(abilityNames: string[], timeoutMs = 5000): Promise<void> {
    for (const name of abilityNames) {
      if (this.#abilityCache.has(name)) continue;
      this.#_abilityName.set(name);
      await waitFor(() => this.#abilityCache.has(name), timeoutMs);
    }
  }

  /**
   * Guarantees the evolution chain for each species is flattened into cache
   * (species bodies must already be fetched — call `ensureSpecies` first).
   */
  async ensureChainFor(pokeNames: string[], timeoutMs = 5000): Promise<void> {
    for (const name of pokeNames) {
      if (this.#chainCache.has(name)) continue;
      const id = this.#chainIdByName.get(name);
      if (!id) continue;
      this.#_chainId.set(id);
      await waitFor(() => this.#chainById.has(id), timeoutMs);
    }
  }

  /** Cannot fetch when nothing is selected or the entry is already cached. */
  private shouldFetchDetail(): boolean {
    const sel = this.selected();
    return Boolean(sel && !this.#detailCache.has(sel.name));
  }

  /** Cannot fetch when no move is requested or it is already cached. */
  private shouldFetchMove(): boolean {
    const name = this.#_moveName();
    return Boolean(name && !this.#moveCache.has(name));
  }

  /** Cannot fetch when no species is requested or its dex entry is cached. */
  private shouldFetchSpecies(): boolean {
    const name = this.#_speciesName();
    return Boolean(name && !this.#speciesCache.has(name));
  }

  /** Cannot fetch when no chain is requested or it is already flattened. */
  private shouldFetchChain(): boolean {
    const id = this.#_chainId();
    return Boolean(id && !this.#chainById.has(id));
  }
}

/** Extracts the numeric evolution-chain id from its API URL. */
export function chainIdFromUrl(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(\d+)\/?$/);
  return m?.[1] ?? null;
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
  moves?: RawMoveSlot[];
  abilities?: RawAbilitySlot[];
}

interface RawAbilitySlot {
  ability?: { name?: string } | null;
  is_hidden?: boolean;
}

interface RawMoveSlot {
  move?: { name?: string } | null;
  version_group_details?: RawMoveVersionDetail[];
}

interface RawMoveVersionDetail {
  level_learned_at?: number;
  move_learn_method?: { name?: string } | null;
}

/** Max real moves kept per pokémon (drives the battle sim + moves section). */
const MOVESET_CAP = 8;
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
    moves: moveset(r),
    abilities: (r.abilities ?? [])
      .map((a) => ({ name: a.ability?.name ?? '', isHidden: a.is_hidden === true }))
      .filter((a) => a.name.length > 0),
  };
}

/**
 * Real level-up moveset from the raw `/pokemon/:name` body: newest version
 * group only, level-up learn method, sorted by level, capped at MOVESET_CAP.
 */
export function moveset(raw: unknown): { name: string; level: number }[] {
  const r = raw as RawDetail;
  const out: { name: string; level: number }[] = [];
  for (const slot of r.moves ?? []) {
    const name = slot.move?.name ?? '';
    if (!name) continue;
    // The API lists version groups oldest → newest; the last one is current.
    const newest = slot.version_group_details?.at(-1);
    if (!newest || (newest.move_learn_method?.name ?? '') !== 'level-up') continue;
    const level = newest.level_learned_at ?? 0;
    if (level <= 0) continue;
    out.push({ name, level });
  }
  out.sort((a, b) => a.level - b.level);
  return out.slice(0, MOVESET_CAP);
}

function stat(raw: RawDetail, name: string): number {
  const hit = (raw.stats ?? []).find((s) => s.stat?.name === name);
  return hit?.base_stat ?? 0;
}

interface RawMove {
  name?: string;
  power?: number | null;
  damage_class?: { name?: string } | null;
  type?: { name?: string } | null;
}

/**
 * Exported for unit tests — maps a raw `/move/:name` body to our FighterMove.
 * Status moves get a token power so they stay usable but never dominate.
 */
export function parseMove(raw: unknown, fallbackName: string): FighterMove {
  const r = raw as RawMove;
  const category = r.damage_class?.name ?? 'physical';
  return {
    name: r.name ?? fallbackName,
    type: r.type?.name ?? 'normal',
    category: category === 'special' ? 'special' : 'physical',
    power: Math.max(1, r.power ?? 25),
  };
}

interface RawAbilityEffect {
  effect_entries?: {
    effect?: string;
    short_effect?: string;
    language?: { name?: string } | null;
  }[];
}

/**
 * Exported for unit tests — English short effect text from a raw
 * `/ability/:name` body (falls back to the full effect, then null).
 */
export function parseAbilityEffect(raw: unknown): string | null {
  const r = raw as RawAbilityEffect;
  const entry = (r.effect_entries ?? []).find((e) => e.language?.name === 'en');
  const text = entry?.short_effect || entry?.effect;
  if (!text) return null;
  return text
    .replace(/\$effect_chance/g, 'chance')
    .replace(/\s+/g, ' ')
    .trim();
}

interface RawFlavorEntry {
  flavor_text?: string;
  language?: { name?: string } | null;
}

interface RawSpecies {
  flavor_text_entries?: RawFlavorEntry[];
  evolves_from_species?: { name?: string } | null;
}

/**
 * Exported for unit tests — the species this one evolves from (null = base
 * form) from a raw `/pokemon-species/:name` body.
 */
export function parseEvolvesFrom(raw: unknown): string | null {
  const r = raw as RawSpecies;
  return r.evolves_from_species?.name ?? null;
}

/**
 * Exported for unit tests — picks the English Pokédex entry from a raw
 * `/pokemon-species/:name` body (first EN entry; form-feed/newline cleaned).
 */
/**
 * Exported for unit tests — picks the English Pokédex entry from a raw
 * `/pokemon-species/:name` body (first EN entry; form-feed/newline cleaned).
 */
export function parseFlavor(raw: unknown): string | null {
  const r = raw as RawSpecies;
  const entry = (r.flavor_text_entries ?? []).find((e) => e.language?.name === 'en');
  const text = entry?.flavor_text;
  if (!text) return null;
  return text
    .replace(/[\f\n\r]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** One step of an evolution chain, human-readable. */
export interface EvoStep {
  /** The species that evolves. */
  species: string;
  /** The species it evolves into. */
  to: string;
  /** How: "level 16", "trade", "item: fire-stone", … */
  trigger: string;
}

interface RawChainLink {
  species?: { name?: string } | null;
  evolution_details?: RawEvoDetail[];
  evolves_to?: RawChainLink[];
}

interface RawEvoDetail {
  min_level?: number | null;
  trigger?: { name?: string } | null;
  item?: { name?: string } | null;
}

interface RawChain {
  chain?: RawChainLink;
}

/** Exported for unit tests — the species body's evolution-chain URL. */
export function parseChainUrl(raw: unknown): string | null {
  const r = raw as RawSpecies & { evolution_chain?: { url?: string } | null };
  return r.evolution_chain?.url ?? null;
}

/** Human trigger label for one evolution detail. */
function triggerLabel(detail: RawEvoDetail | undefined): string {
  if (!detail) return 'evolution';
  if (detail.min_level) return `level ${detail.min_level}`;
  if (detail.item?.name) return `item: ${detail.item.name}`;
  return detail.trigger?.name ?? 'evolution';
}

/**
 * Exported for unit tests — flattens a raw `/evolution-chain/:id` body into
 * one human-readable step per species → evolution edge.
 */
export function parseChain(raw: unknown): EvoStep[] {
  const root = (raw as RawChain).chain;
  const out: EvoStep[] = [];
  const walk = (link: RawChainLink | undefined) => {
    if (!link?.species?.name) return;
    for (const next of link.evolves_to ?? []) {
      const toName = next.species?.name;
      if (!toName) continue;
      out.push({
        species: link.species!.name!,
        to: toName,
        trigger: triggerLabel(next.evolution_details?.[0]),
      });
      walk(next);
    }
  };
  walk(root);
  return out;
}

/** Exported for unit tests — every species name mentioned in a chain body. */
export function speciesInChain(raw: unknown): string[] {
  const names: string[] = [];
  const walk = (link: RawChainLink | undefined) => {
    if (!link?.species?.name) return;
    names.push(link.species.name);
    for (const next of link.evolves_to ?? []) walk(next);
  };
  walk((raw as RawChain).chain);
  return names;
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

/**
 * Exported for unit tests — builds a wild-zone pool from area encounter lists:
 * dedupes by species, drops species beyond the era cap, shuffles.
 */
export function buildZonePool(areas: LocationArea[], genCap: number): PokeId[] {
  const maxId = maxIdForGen(genCap);
  const seen = new Set<string>();
  const pool: PokeId[] = [];
  for (const area of areas) {
    for (const enc of area.pokemon_encounters) {
      const name = enc.pokemon.name;
      const id = Number(enc.pokemon.url.match(/\/(\d+)\/?$/)?.[1] ?? '0');
      if (!name || seen.has(name) || id <= 0 || id > maxId) continue;
      seen.add(name);
      pool.push({ name, url: enc.pokemon.url });
    }
  }
  // Fisher–Yates shuffle (not cryptographically relevant here).
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool;
}
