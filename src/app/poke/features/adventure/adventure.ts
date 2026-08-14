import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Game } from '@poke/game';
import { PokeData } from '@poke/poke-data';
import { Notify } from '@poke/notify';
import { PokeLocation } from '@poke/poke.model';
import { catchChance } from '@poke/economy';
import { KANTO_REGIONS, regionStatuses, RegionStatus } from '@poke/adventure-regions';
import { BasicView } from '@shared/ui';

@Component({
  selector: 'app-poke-adventure',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, BasicView],
  templateUrl: './adventure.component.html',
  styleUrl: './adventure.component.scss',
})
export class Adventure {
  // Injected dependencies
  readonly data = inject(PokeData);
  readonly game = inject(Game);
  #notify = inject(Notify);

  /** Wild pokémon currently selected for catch attempt. */
  selectedWild = signal<{ name: string; baseExperience: number; sprite: string } | null>(null);

  /** Catch attempt result message. */
  catchResult = signal<{ success: boolean; message: string } | null>(null);

  /** Which region of the unlock chain is open on the map. */
  regionIndex = signal(0);

  regStatuses = computed(() => regionStatuses(new Set(this.game.visited())));

  /** The region currently open (clamped to the first unlocked one). */
  current = computed<RegionStatus>(() => {
    const statuses = this.regStatuses();
    const wanted = statuses[this.regionIndex()];
    if (wanted?.unlocked) return wanted;
    return statuses.find((s) => s.unlocked) ?? statuses[0]!;
  });

  /** Encounters in currently explored area (filtered by generation), with sprites. */
  encounters = computed(() =>
    this.data.areaEncounters().map((enc) => ({
      ...enc,
      sprite: this.data.spriteUrlOrEmpty(enc.pokemon.name),
    })),
  );

  /** Areas of the current region, enriched with image + visited state. */
  areas = computed(() =>
    this.current().def.areas.map((loc) => ({
      ...loc,
      image: this.locationImage(loc),
      visited: this.game.visited().includes(loc.url),
    })),
  );

  /** Artwork for the current region card. */
  currentArt = computed(() => this.regionArt(this.current().index));

  /** Whether we're currently exploring an area. */
  isExploring = computed(() => this.data.exploringArea() !== null);

  /** Current area name being explored. */
  currentArea = computed(() => this.data.exploringArea()?.name ?? '');

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

  /** Travel one region forward (only when the current one is fully explored). */
  canGoNext = computed(() => {
    const statuses = this.regStatuses();
    const next = statuses[this.current().index + 1];
    return !!next && next.unlocked;
  });

  canGoPrev = computed(() => this.current().index > 0);

  goNext() {
    if (this.canGoNext()) this.regionIndex.set(this.current().index + 1);
  }

  goPrev() {
    if (this.canGoPrev()) this.regionIndex.set(this.current().index - 1);
  }

  goToRegion(index: number) {
    const status = this.regStatuses()[index];
    if (!status) return null;
    if (!status.unlocked) {
      this.#notify.show(`Explore every zone of "${KANTO_REGIONS[index - 1]?.name}" first.`);
      return null;
    }
    this.regionIndex.set(index);
    return null;
  }

  /** Explore a location area (marks it visited for the region unlock). */
  explore(loc: PokeLocation) {
    this.data.explore(loc);
    this.game.markVisited(loc.url);
    this.selectedWild.set(null);
    this.catchResult.set(null);
  }

  /** Leave current area back to map. */
  leaveArea() {
    this.data.leaveArea();
    this.selectedWild.set(null);
    this.catchResult.set(null);
  }

  /** Select a wild pokémon to attempt catch. */
  selectWild(enc: { pokemon: { name: string; url: string } }) {
    const baseExp = this.data.pokeByName(enc.pokemon.name)?.baseExperience ?? 64;
    this.selectedWild.set({
      name: enc.pokemon.name,
      baseExperience: baseExp,
      sprite: this.data.spriteUrlOrEmpty(enc.pokemon.name),
    });
    this.catchResult.set(null);
  }

  /** Attempt to catch the selected wild pokémon (consumes one ball from the bag). */
  throwBall() {
    const wild = this.selectedWild();
    if (!wild) return;

    const mult = this.game.spendBestBall();
    if (mult === 0) {
      this.catchResult.set({
        success: false,
        message: 'No Pokéballs left! Buy some in the Market first.',
      });
      return;
    }

    const success = Math.random() < Math.min(1, catchChance(wild.baseExperience) * mult);
    if (success) {
      this.game.add(wild.name, 1);
      this.game.noteCatch();
      this.data.registerNameId(wild.name, this.data.pokeByName(wild.name)?.id ?? 0);
      this.catchResult.set({ success: true, message: `Caught ${wild.name}!` });
      this.selectedWild.set(null);
    } else {
      this.catchResult.set({ success: false, message: `${wild.name} escaped!` });
    }
  }

  /** Location-area sprite from PokeAPI (with a generic fallback). */
  locationImage(loc: PokeLocation): string {
    const id = loc.url.match(/\/(\d+)\/?$/)?.[1];
    return id
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/locations/${id}.png`
      : this.fallbackImage();
  }

  /** Fallback art for a region card (its first representative area). */
  regionArt(index: number): string {
    const ids = this.regStatuses()[index]?.def.artAreaIds ?? [];
    return ids.length
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/locations/${ids[0]}.png`
      : this.fallbackImage();
  }

  private fallbackImage(): string {
    return 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/locations/1.png';
  }
}
