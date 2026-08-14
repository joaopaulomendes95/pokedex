import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Game } from '@poke/game';
import { PokeData } from '@poke/poke-data';
import { Notify } from '@poke/notify';
import { PokeId } from '@poke/poke.model';
import { catchChance } from '@poke/economy';
import { Battle, buildFighter } from '@poke/battle';
import { generationFromId } from '@poke/generation';
import { artworkUrlForDexId, WORLD_ZONES, zoneAreaUrls, WorldZone } from '@poke/adventure-regions';
import { BasicView, CustomSpinner } from '@shared/ui';

/** Odds of catching a shiny variant (1 in 64). */
export const SHINY_CHANCE = 1 / 64;

/** A wild pokémon ready to fight: enriched with sprite + base experience. */
interface WildPick {
  name: string;
  url: string;
  sprite: string;
  baseExperience: number;
}

/** One zone card on the map. */
interface ZoneCard {
  def: WorldZone;
  index: number;
  /** How many species from this zone the player already owns. */
  caught: number;
  art: string;
}

/**
 * Adventure — fight-to-catch zones. PokeAPI has no location photos, so the
 * world is 5 macro-zones; in each one you hit "Go catch some", a pool of
 * wild pokémon appears, you pick one and FIGHT it; winning gives you a
 * chance to throw a ball and catch it.
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

  /** Selected zone on the map. */
  zoneIndex = signal(0);

  /** Zone cards (all open — the 5 mains replace the long region rail). */
  readonly zones = computed<ZoneCard[]>(() =>
    WORLD_ZONES.map((def, index) => ({
      def,
      index,
      art: artworkUrlForDexId(def.signature),
      caught: this.ownedInZone(def),
    })),
  );

  readonly currentZone = computed(() => this.zones()[this.zoneIndex()] ?? this.zones()[0]!);

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
    return Math.round(Math.min(1, catchChance(w.baseExperience) * mult) * 100);
  });

  /** Wild fight level scales with the zone (and a little randomness). */
  wildLevel = computed(() => 10 + this.currentZone().index * 6 + Math.floor(Math.random() * 4));

  openZone(index: number) {
    this.zoneIndex.set(index);
    this.selectedWild.set(null);
    this.fightResult.set(null);
    this.catchResult.set(null);
    if (this.pool().length === 0) void this.loadPool();
  }

  /** Fetch the zone's wild pool (one species per area, era-capped, shuffled). */
  async loadPool() {
    const zone = this.currentZone().def;
    this.poolLoading.set(true);
    this.poolError.set(false);
    try {
      const picks = await this.data.zonePool(zoneAreaUrls(zone), zone.gen);
      this.pool.set(
        picks.map((p) => ({
          name: p.name,
          url: p.url,
          sprite: this.data.spriteUrlOrEmpty(p.name),
          baseExperience: this.data.pokeByName(p.name)?.baseExperience ?? 64,
        })),
      );
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
        const xp = 12 + this.currentZone().index * 8;
        this.game.grantXp(champ.name, xp);
        this.#notify.show(`You beat the wild ${wild.name}! (+${xp} XP)`);
      } else {
        this.fightResult.set('lost');
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
      return;
    }

    const success = Math.random() < Math.min(1, catchChance(wild.baseExperience) * mult);
    if (success) {
      const shiny = Math.random() < SHINY_CHANCE;
      this.game.add(wild.name, 1, shiny);
      this.game.noteCatch();
      this.data.registerNameId(wild.name, this.data.pokeByName(wild.name)?.id ?? 0);
      this.catchResult.set({
        success: true,
        message: shiny ? `✨ Shiny ${wild.name} caught!` : `Caught ${wild.name}!`,
      });
      this.selectedWild.set(null);
    } else {
      this.catchResult.set({ success: false, message: `${wild.name} escaped!` });
    }
  }

  /** How many species from this zone's era the player already owns. */
  private ownedInZone(def: WorldZone): number {
    const owned = new Set(this.game.roster().map((r) => r.name));
    let count = 0;
    for (const name of owned) {
      const id = this.data.pokeByName(name)?.id ?? 0;
      const gen = generationFromId(id || Number.MAX_SAFE_INTEGER);
      if (id > 0 && gen >= def.genStart && gen <= def.gen) count++;
    }
    return count;
  }

  constructor() {
    // Reset the artwork-failure flag whenever the zone changes.
    effect(
      () => {
        this.currentZone().index;
        this.artOk.set(true);
      },
      { allowSignalWrites: true },
    );
  }
}
