import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Game } from '@poke/game';
import { PokeData } from '@poke/poke-data';
import { Notify } from '@poke/notify';
import { catchChance } from '@poke/economy';
import { Battle, buildFighter } from '@poke/battle';
import { generationFromId } from '@poke/generation';
import { GenerationFilter } from '@poke/generation-filter';
import {
  artworkUrlForDexId,
  KANTO_REGIONS,
  RegionDef,
  RegionGroup,
  groupedRegions,
  regionAreaUrls,
} from '@poke/adventure-regions';
import { BasicView, CustomSpinner } from '@shared/ui';

/** Odds of catching a shiny variant (1 in 64). */
export const SHINY_CHANCE = 1 / 64;

/** How many wild picks the zone fetch returns before filtering/weighting. */
const POOL_SOURCE_SIZE = 200;
/** How many picks the player actually sees (after first-evo filter + quality sort). */
export const POOL_SIZE = 12;
/** How many of the pool are the region's strongest species (rest is random). */
const POOL_QUALITY_KEEP = 8;
/** How long a wild pool stays before it "moves on" (random encounters). */
export const POOL_TTL_MS = 45_000;

/** Rarity tier shown on wild-pool cards (driven by base experience). */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/**
 * Exported for unit tests — rarity band from a species' base experience.
 * Base XP: pidgey 50 → common; pikachu 112 → rare; gyarados 189 → epic;
 * dragonite 270 → legendary.
 */
export function rarityFor(baseExp: number): Rarity {
  if (baseExp >= 220) return 'legendary';
  if (baseExp >= 160) return 'epic';
  if (baseExp >= 110) return 'rare';
  if (baseExp >= 70) return 'uncommon';
  return 'common';
}

/** A wild pokémon ready to fight: enriched with sprite + base experience. */
interface WildPick {
  name: string;
  url: string;
  sprite: string;
  baseExperience: number;
  rarity: Rarity;
}

/** One region card on the map. */
interface RegionCard {
  def: RegionDef;
  /** How many species of this region's generation the player already owns. */
  caught: number;
  art: string;
}

/**
 * Adventure — fight-to-catch regions. PokeAPI has no location photos, so the
 * map is the curated regions grouped by era; each one you hit "Go catch some",
 * a pool of wild pokémon appears, you pick one and FIGHT it; winning gives you
 * a chance to throw a ball and catch it. Only regions within the save's
 * generation are shown — no locked cards.
 */
@Component({
  selector: 'app-poke-adventure',
  imports: [MatButtonModule, MatIconModule, BasicView, CustomSpinner],
  templateUrl: './adventure.component.html',
  styleUrl: './adventure.component.scss',
})
export class Adventure {
  // Injected dependencies
  readonly data = inject(PokeData);
  readonly game = inject(Game);
  #notify = inject(Notify);
  #genFilter = inject(GenerationFilter);

  /** Travelable region groups for this save (macro-zones → in-gen regions). */
  readonly regionGroups = computed(() => groupedRegions(this.#genFilter.maxGen()));

  /** Flat list of all travelable regions (drives the selected-region logic). */
  readonly regions = computed<RegionDef[]>(() => this.regionGroups().flatMap((g) => g.regions));

  /** Currently selected region (by id — survives list reordering). */
  readonly regionId = signal<string>('');
  readonly currentRegion = computed(
    () =>
      this.regions().find((r) => r.id === this.regionId()) ??
      this.regions()[0] ??
      (null as RegionDef | null),
  );

  /** Region cards enriched for the template (per group, built per render). */
  readonly regionCards = computed<{ group: RegionGroup; cards: RegionCard[] }[]>(() =>
    this.regionGroups().map((group) => ({
      group,
      cards: group.regions.map((def) => ({
        def,
        art: artworkUrlForDexId(def.signature),
        caught: this.ownedInRegion(def),
      })),
    })),
  );

  /** Dex completion meter: unique owned species of the save's generation. */
  readonly dexOwned = computed(
    () => [...this.game.collection().keys()].filter((n) => this.data.isInMasterList(n)).length,
  );
  readonly dexTotal = computed(() => this.data.masterList().length);
  readonly dexPct = computed(() =>
    this.dexTotal() > 0 ? Math.round((this.dexOwned() / this.dexTotal()) * 100) : 0,
  );
  /** The save's max generation (shown on the dex meter). */
  readonly genFilterMaxGen = computed(() => this.#genFilter.maxGen());

  /** Wild pool for the current zone (lazy-loaded). */
  readonly pool = signal<WildPick[]>([]);
  readonly poolLoading = signal(false);
  readonly poolError = signal(false);

  /** Wild pokémon selected for the fight. */
  selectedWild = signal<WildPick | null>(null);

  readonly fightBusy = signal(false);
  readonly fightResult = signal<'won' | 'lost' | null>(null);

  /** Catch attempt result message. */
  catchResult = signal<{ success: boolean; message: string } | null>(null);

  /** True until the zone artwork fails to load (falls back to the gradient). */
  artOk = signal(true);

  /** True while the wild fight is resolving. */
  readonly fighting = computed(() => this.fightBusy() || this.data.detailLoading());

  /** The player's strongest owned pokémon (the one that fights). */
  readonly champion = computed(() => {
    const roster = this.game.roster();
    if (roster.length === 0) return null;
    return [...roster].sort((a, b) => b.level - a.level)[0]!;
  });

  /** Best ball the player owns for the current catch (null when the bag is empty). */
  bestBall = computed<{ name: string; mult: number } | null>(() => {
    const order = [
      ['ultraball', 2],
      ['greatball', 1.5],
      ['pokeball', 1],
    ] as const;
    for (const [id, mult] of order) {
      if (this.game.itemCount(id) > 0) return { name: id, mult };
    }
    return null;
  });

  /** Catch chance percentage accounting for the best available ball. */
  catchPct = computed(() => {
    const w = this.selectedWild();
    if (!w) return 0;
    const mult = this.bestBall()?.mult ?? 1;
    return Math.round(
      Math.min(1, catchChance(w.baseExperience) * mult * this.game.catchMultiplier()) * 100,
    );
  });

  /** Wild fight level scales with the zone (and a little randomness). */
  readonly wildLevel = signal(0);

  /** When the current wild pool expires and re-rolls (random-encounter feel). */
  readonly poolExpiresAt = signal(0);

  /** Seconds until the pool re-rolls (0 = no live pool). */
  readonly poolSecondsLeft = computed(() => {
    const at = this.poolExpiresAt();
    if (!at) return 0;
    return Math.max(0, Math.ceil((at - Date.now()) / 1000));
  });

  /** Travel to a region: reset the fight state and load its wild pool. */
  openRegion(regionId: string) {
    if (!this.regions().some((r) => r.id === regionId)) return;
    this.regionId.set(regionId);
    this.selectedWild.set(null);
    this.fightResult.set(null);
    this.catchResult.set(null);
    // Always (re)load the pool — each region has its own areas/era, so the
    // wild pool must change when the player moves around the map.
    void this.loadPool();
  }

  /**
   * Fetch the region's wild pool: first evolutions only, weighted towards the
   * stronger species of the region (higher base XP first) with a few random
   * picks mixed in so every species of the gen can eventually appear, then
   * shuffled.
   */
  async loadPool() {
    const region = this.currentRegion();
    if (!region) return;
    const regionId = region.id;
    this.poolLoading.set(true);
    this.poolError.set(false);
    try {
      const source = await this.data.zonePool(regionAreaUrls(region), region.gen, POOL_SOURCE_SIZE);
      // Stale response (the player switched regions mid-fetch) — drop it.
      if (this.currentRegion()?.id !== regionId) return;
      // Know each pick's stage: species bodies tell us what they evolve from.
      await this.data.ensureSpecies(source.map((p) => p.name)).catch(() => undefined);
      if (this.currentRegion()?.id !== regionId) return;
      // First evolutions only — drop species we KNOW are evolved forms; keep
      // unknowns (species body still loading) so pools never run dry.
      const base = source.filter((p) => {
        const from = this.data.evolvesFrom(p.name);
        return from === undefined || from === null;
      });
      const enriched = base.map((p) => {
        const baseExp = this.data.pokeByName(p.name)?.baseExperience ?? 64;
        return {
          name: p.name,
          url: p.url,
          sprite: this.data.spriteUrlOrEmpty(p.name),
          baseExperience: baseExp,
          rarity: rarityFor(baseExp),
        };
      });
      // Quality first (keeps pools feeling strong) + a few random picks so
      // weak/common species still cycle in — needed to complete the dex.
      enriched.sort((a, b) => b.baseExperience - a.baseExperience);
      const keep = Math.min(POOL_QUALITY_KEEP, enriched.length);
      const top = enriched.slice(0, keep);
      const rest = [...enriched.slice(keep)];
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j]!, rest[i]!];
      }
      const mix = [...top, ...rest.slice(0, Math.max(0, POOL_SIZE - keep))];
      for (let i = mix.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mix[i], mix[j]] = [mix[j]!, mix[i]!];
      }
      this.pool.set(mix);
      // The pool only "stays" for a while — like real random encounters.
      this.poolExpiresAt.set(Date.now() + POOL_TTL_MS);
    } catch {
      this.poolError.set(true);
    } finally {
      this.poolLoading.set(false);
    }
  }

  retryPool() {
    void this.loadPool();
  }

  /** Pick a wild pokémon to fight. */
  selectWild(pick: WildPick) {
    this.selectedWild.set(pick);
    this.fightResult.set(null);
    this.catchResult.set(null);
    // Roll the wild's level once, when it's picked (stable across the fight).
    const region = this.currentRegion();
    const depth = region ? KANTO_REGIONS.findIndex((r) => r.id === region.id) : 0;
    this.wildLevel.set(10 + Math.max(0, depth) * 6 + Math.floor(Math.random() * 4));
  }

  /** Fight the wild pokémon with your strongest owned one. */
  async fight() {
    const wild = this.selectedWild();
    const champ = this.champion();
    if (!wild || !champ) return;
    if (this.fightBusy()) return;

    this.fightBusy.set(true);
    this.fightResult.set(null);
    try {
      const names = [champ.name, wild.name];
      await this.data.ensureInCache(names);
      await this.data.ensureMoves(names);

      const mine = this.data.pokeByName(champ.name);
      const theirs = this.data.pokeByName(wild.name);
      if (!mine || !theirs) return;

      const myFighter = buildFighter(
        champ.name,
        mine.spriteUrl,
        mine.types,
        mine.stats,
        champ.level,
        this.data.movesFor(champ.name),
        champ.stars ?? 0,
        this.data.isApex(champ.name),
      );
      const wildFighter = buildFighter(
        wild.name,
        theirs.spriteUrl,
        theirs.types,
        theirs.stats,
        this.wildLevel(),
        this.data.movesFor(wild.name),
      );

      const res = new Battle().simulate(
        { name: 'You', fighters: [myFighter] },
        { name: 'Wild', fighters: [wildFighter] },
      );

      if (res.winner === 'player') {
        this.fightResult.set('won');
        const region = this.currentRegion();
        const depth = region ? KANTO_REGIONS.findIndex((r) => r.id === region.id) : 0;
        const xp = 12 + Math.max(0, depth) * 8;
        this.game.grantXp(champ.name, xp);
        this.#notify.show(`You beat the wild ${wild.name}! (+${xp} XP)`);
      } else {
        // It got away — it leaves the pool so it can't be farmed again.
        this.pool.update((pool) => pool.filter((p) => p.name !== wild.name));
        this.fightResult.set('lost');
        this.#notify.show(`The wild ${wild.name} got away…`);
      }
    } catch {
      this.#notify.show('Something went wrong with the wild fight — try again.');
    } finally {
      this.fightBusy.set(false);
    }
  }

  /** Attempt to catch the defeated wild pokémon (consumes one ball). */
  throwBall() {
    const wild = this.selectedWild();
    if (!wild) return;

    const mult = this.game.spendBestBall();
    if (mult === 0) {
      this.catchResult.set({
        success: false,
        message: 'No Pokéballs left! Buy some in the Shop first.',
      });
      this.#notify.showError('No Pokéballs left — buy some in the Shop.');
      return;
    }

    const success =
      Math.random() <
      Math.min(1, catchChance(wild.baseExperience) * mult * this.game.catchMultiplier());
    if (success) {
      const shiny = Math.random() < SHINY_CHANCE;
      const alreadyOwned = this.game.own(wild.name);
      if (alreadyOwned) {
        // Duplicate catch → ascend a star (up to 5); maxed species transfer
        // for coins as before.
        const next = this.game.addStar(wild.name);
        if (next > 0) {
          this.game.noteCatch();
          this.catchResult.set({
            success: true,
            message: `Duplicate ${wild.name} — ascended to ★${next}!`,
          });
          this.#notify.show(`Duplicate ${wild.name} — ascended to ★${next}!`);
          this.selectedWild.set(null);
          return;
        }
        // Already 5★ → coins, scaled by wild level.
        const value = this.game.releaseValue(this.wildLevel());
        this.game.grantCoins(value);
        this.game.noteCatch();
        this.catchResult.set({
          success: true,
          message: `${wild.name} is maxed ★ — transferred it for +${value}¢!`,
        });
        this.#notify.show(`${wild.name} is maxed ★ — transferred it for +${value}¢.`);
        this.selectedWild.set(null);
        return;
      }
      this.game.add(wild.name, 1, shiny);
      this.game.noteCatch();
      this.data.registerNameId(wild.name, this.data.pokeByName(wild.name)?.id ?? 0);
      this.catchResult.set({
        success: true,
        message: shiny ? `✨ Shiny ${wild.name} caught!` : `Caught ${wild.name}!`,
      });
      this.#notify.show(shiny ? `✨ Shiny ${wild.name} caught!` : `🎉 Caught ${wild.name}!`);
      this.selectedWild.set(null);
    } else {
      this.catchResult.set({ success: false, message: `${wild.name} escaped!` });
      this.#notify.showError(`The ${wild.name} escaped… try again!`);
    }
  }

  /** True when the player already owns this species (dup marker on pool cards). */
  owns(name: string): boolean {
    return Boolean(this.game.own(name));
  }

  /** How many species of this region's generation the player already owns. */
  private ownedInRegion(def: RegionDef): number {
    const owned = new Set(this.game.roster().map((r) => r.name));
    let count = 0;
    for (const name of owned) {
      const id = this.data.pokeByName(name)?.id ?? 0;
      const gen = generationFromId(id || Number.MAX_SAFE_INTEGER);
      if (id > 0 && gen === def.gen) count++;
    }
    return count;
  }

  #destroyRef = inject(DestroyRef);

  constructor() {
    // Reset the artwork-failure flag whenever the region changes.
    effect(
      () => {
        void this.currentRegion()?.id;
        this.artOk.set(true);
      },
      { allowSignalWrites: true },
    );

    // Random encounters: when the pool's time window runs out, re-roll it
    // automatically (keeps a live countdown in the template).
    interval(1000)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => {
        const at = this.poolExpiresAt();
        if (at > 0 && Date.now() >= at && !this.poolLoading()) {
          void this.loadPool();
        }
      });
  }
}
