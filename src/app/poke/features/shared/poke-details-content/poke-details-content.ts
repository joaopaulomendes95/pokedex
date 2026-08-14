import { Component, computed, effect, inject, input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PokeData } from '@poke/poke-data';
import { Game } from '@poke/game';
import { type CustomChipColor, type DetailsBlockRow, type DetailsSection } from '@shared/ui';
import { DetailsSections } from '@shared/ui/dialog/details-sections/details-sections';
import { CustomChip } from '@shared/ui';
import { xpForLevel } from '@poke/economy';
import { typeColor } from '@poke/features/shared/poke-type-color';

export interface PokeDetailsContentData {
  name: string;
}

/**
 * Content component embedded in the slide-in "DetailDialog" (DetailsBlock).
 * Renders a Pokémon's artwork, type chips and a read-only stat/profile section
 * grid composed from DetailsSections.
 */
@Component({
  selector: 'app-poke-details-content',
  imports: [DetailsSections, CustomChip, MatProgressSpinnerModule],
  templateUrl: './poke-details-content.component.html',
  styleUrl: './poke-details-content.component.scss',
})
export class PokeDetailsContent {
  readonly data = input.required<PokeDetailsContentData>();

  readonly poke = inject(PokeData);
  readonly game = inject(Game);

  readonly detail = computed(() => this.poke.pokeByName(this.data().name) ?? this.poke.detail());

  readonly owned = computed(() => this.game.own(this.data().name) ?? null);

  /** XP needed for the owned pokémon's next level. */
  readonly xpNeed = computed(() => {
    const o = this.owned();
    return o ? xpForLevel(o.level) : 0;
  });

  /** XP bar fill % for the owned pokémon (0..100). */
  readonly xpPct = computed(() => {
    const o = this.owned();
    return o ? Math.min(100, Math.floor((o.xp / xpForLevel(o.level)) * 100)) : 0;
  });

  readonly sections = computed<DetailsSection[]>(() => {
    const d = this.detail();
    if (!d) return [];
    const sections: DetailsSection[] = [
      {
        name: 'Stats',
        rows: [
          {
            cols: 3,
            items: [
              { label: 'HP', data: [d.stats.hp], faIcon: 'heart' },
              { label: 'Attack', data: [d.stats.attack], faIcon: 'hand-fist' },
              { label: 'Defense', data: [d.stats.defense], faIcon: 'shield' },
            ],
          },
          {
            cols: 3,
            items: [
              { label: 'Sp. Attack', data: [d.stats.spAtk], faIcon: 'wand-magic-sparkles' },
              { label: 'Sp. Defense', data: [d.stats.spDef], faIcon: 'shield-halved' },
              { label: 'Speed', data: [d.stats.speed], faIcon: 'gauge-high' },
            ],
          },
        ],
      },
      {
        name: 'Profile',
        rows: [
          {
            cols: 3,
            items: [
              { label: 'Pokédex #', data: [d.id], faIcon: 'hashtag' },
              { label: 'Types', data: [d.types.join(' / ')], faIcon: 'dna' },
              { label: 'Base XP', data: [d.baseExperience], faIcon: 'star' },
            ],
          },
          {
            cols: 2,
            items: [
              { label: 'Catch rate', data: [`${this.catchRate()}%`], faIcon: 'circle-info' },
              {
                label: 'Ball cost',
                data: [`${15 + Math.round((d.baseExperience || 0) * 0.3)}¢`],
                faIcon: 'coins',
              },
            ],
          },
        ],
      },
    ];

    // Real abilities from the detail body (hidden ones tagged), with effect text.
    if (d.abilities.length > 0) {
      sections.push({
        name: 'Abilities',
        rows: [
          {
            cols: 1,
            items: d.abilities.map((a) => ({
              label: a.isHidden ? `${a.name} (hidden)` : a.name,
              data: [this.poke.abilityEffect(a.name) ?? a.name],
              faIcon: 'sparkles',
            })),
          },
        ],
      });
    }

    // Real dex entry from `/pokemon-species/:name` (warmed lazily).
    const flavor = this.poke.speciesFlavor(this.data().name);
    if (flavor) {
      sections.push({
        name: 'Pokédex entry',
        style: 'filled',
        rows: [{ cols: 1, items: [{ label: 'Entry', data: [flavor], faIcon: 'book-open' }] }],
      });
    }

    // Real level-up moveset from the detail body.
    if (d.moves.length > 0) {
      const rows: DetailsBlockRow[] = [];
      for (let i = 0; i < d.moves.length; i += 2) {
        const pair = d.moves.slice(i, i + 2);
        rows.push({
          cols: 2,
          items: pair.map((m) => ({
            label: `Lv ${m.level}`,
            data: [m.name],
            faIcon: 'hand-fist',
          })),
        });
      }
      sections.push({ name: 'Moves', rows });
    }

    // Real evolution chain from `/evolution-chain/:id`.
    const evo = this.poke.evolutionFor(this.data().name);
    if (evo.length > 0) {
      sections.push({
        name: 'Evolution',
        rows: [
          {
            cols: 2,
            items: evo.map((step) => ({
              label: step.species,
              data: [`→ ${step.to}`],
              suffix: `(${step.trigger})`,
              faIcon: 'arrow-trend-up',
            })),
          },
        ],
      });
    }

    return sections;
  });

  constructor() {
    // Warm the dex entry + evolution chain so they appear as they land.
    effect(() => {
      const name = this.data().name;
      if (!name) return;
      void this.poke.ensureSpecies([name]).then(() => void this.poke.ensureChainFor([name]));
    });
    // Warm ability effect texts for the current pokémon.
    effect(() => {
      const names = this.detail()?.abilities.map((a) => a.name) ?? [];
      if (names.length) void this.poke.ensureAbilities(names);
    });
  }

  catchRate(): number {
    const base = this.detail()?.baseExperience ?? 0;
    return Math.round((40 / (base || 1)) * 100);
  }

  /** Chip colour for a Pokémon type (exposed for the template). */
  typeColor(t: string): CustomChipColor {
    return typeColor(t);
  }
}
