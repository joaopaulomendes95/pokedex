import { describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SquadBuilder } from './squad-builder';
import { PokeData } from '@poke/poke-data';
import { Game } from '@poke/game';
import { Notify } from '@poke/notify';
import { PokeDetail } from '@poke/poke.model';

/** Minimal PokeData stub — enough surface for SquadBuilder + DetailPanel to render. */
function stubPokeData(): PokeData {
  const detail: PokeDetail = {
    id: 1,
    name: 'bulbasaur',
    types: ['grass'],
    stats: { hp: 45, attack: 49, defense: 49, spAtk: 65, spDef: 65, speed: 45 },
    spriteUrl: '',
    artworkUrl: '',
    baseExperience: 64,
    moves: [],
    abilities: [],
  };
  return {
    pokeByName: (n: string) => (n === 'bulbasaur' ? detail : null),
    spriteUrlOrEmpty: () => '',
    shinySpriteUrl: () => '',
    selected: () => null,
    selectByName: () => undefined,
    evolutionFor: (n: string) =>
      n === 'bulbasaur' || n === 'ivysaur' || n === 'venusaur'
        ? [
            { species: 'bulbasaur', to: 'ivysaur', trigger: 'level 16' },
            { species: 'ivysaur', to: 'venusaur', trigger: 'level 32' },
          ]
        : [],
    ensureInCache: async () => undefined,
    ensureSpecies: async () => undefined,
    ensureChainFor: async () => undefined,
    detail: () => undefined,
    detailLoading: () => false,
    detailError: () => null,
    retryDetail: () => undefined,
    registerNameId: () => undefined,
  } as unknown as PokeData;
}

describe('SquadBuilder swap modal', () => {
  let fixture: ComponentFixture<SquadBuilder>;

  async function mount(): Promise<void> {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SquadBuilder],
      providers: [
        provideZonelessChangeDetection(),
        { provide: PokeData, useValue: stubPokeData() },
        {
          provide: Notify,
          useValue: {
            show: () => undefined,
            showError: () => undefined,
            showSuccess: () => undefined,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SquadBuilder);
    await fixture.whenStable();
  }

  it('closes the swap modal when the overlay itself is clicked', async () => {
    await mount();
    const game = TestBed.inject(Game);
    // Fill the squad to the cap so a double-click opens the swap modal.
    game.setSquad(['bulbasaur', 'bulbasaur', 'bulbasaur', 'bulbasaur', 'bulbasaur', 'bulbasaur']);
    game.add('pikachu', 1);
    fixture.componentInstance.fieldOrSwap('pikachu');
    fixture.detectChanges();
    expect(fixture.componentInstance.swapModal()).toEqual({ incoming: 'pikachu' });

    // A click whose target IS the overlay (no bubbled child) must close it.
    const overlay = fixture.nativeElement.querySelector('.swap-modal-overlay') as HTMLElement;
    expect(overlay).not.toBeNull();
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.swapModal()).toBeNull();
  });

  it('keeps the modal open when a click bubbles from inside the dialog', async () => {
    await mount();
    const game = TestBed.inject(Game);
    game.setSquad(['bulbasaur', 'bulbasaur', 'bulbasaur', 'bulbasaur', 'bulbasaur', 'bulbasaur']);
    game.add('pikachu', 1);
    fixture.componentInstance.fieldOrSwap('pikachu');
    fixture.detectChanges();
    expect(fixture.componentInstance.swapModal()).toEqual({ incoming: 'pikachu' });

    // A click on a child (the dialog panel) must NOT close the modal:
    // the event target differs from the overlay's currentTarget.
    const dialog = fixture.nativeElement.querySelector('.swap-modal') as HTMLElement;
    expect(dialog).not.toBeNull();
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.swapModal()).toEqual({ incoming: 'pikachu' });
  });

  it('closes on Escape via the overlay keydown handler', async () => {
    await mount();
    const game = TestBed.inject(Game);
    game.setSquad(['bulbasaur', 'bulbasaur', 'bulbasaur', 'bulbasaur', 'bulbasaur', 'bulbasaur']);
    game.add('pikachu', 1);
    fixture.componentInstance.fieldOrSwap('pikachu');
    fixture.detectChanges();
    expect(fixture.componentInstance.swapModal()).toEqual({ incoming: 'pikachu' });

    const overlay = fixture.nativeElement.querySelector('.swap-modal-overlay') as HTMLElement;
    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.swapModal()).toBeNull();
  });

  it('only offers an evolve step that starts from the pokémon itself', async () => {
    await mount();
    const game = TestBed.inject(Game);

    // Fully evolved member of the same chain — no step starts from it.
    game.add('venusaur', 40);
    const rows = fixture.componentInstance.team();
    expect(rows.find((r) => r.owned.name === 'venusaur')?.evolvesTo).toBeNull();
    // Not at the required level yet.
    expect(rows.find((r) => r.owned.name === 'bulbasaur')?.evolvesTo).toBeNull();

    // Reach the first level trigger → the direct next stage appears.
    game.addLevel('bulbasaur', 20);
    const rows2 = fixture.componentInstance.team();
    expect(rows2.find((r) => r.owned.name === 'bulbasaur')?.evolvesTo).toBe('ivysaur');
  });
});
