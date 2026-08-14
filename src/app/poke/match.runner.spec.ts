import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatchRunner } from '@poke/match.runner';
import { PokeData } from '@poke/poke-data';
import { Game } from '@poke/game';
import { PokeDetail } from '@poke/poke.model';

function detail(name: string): PokeDetail {
  return {
    id: 1,
    name,
    types: ['normal'],
    stats: { hp: 100, attack: 50, defense: 50, spAtk: 50, spDef: 50, speed: 50 },
    spriteUrl: '',
    artworkUrl: '',
    baseExperience: 64,
    moves: [],
    abilities: [],
  };
}

function stubPoke(names: string[]): PokeData {
  const cache = new Map(names.map((n) => [n, detail(n)]));
  return {
    pokeByName: (n: string) => cache.get(n) ?? null,
    spriteUrlOrEmpty: () => '',
    ensureInCache: async () => {},
    ensureMoves: async () => {},
    movesFor: () => [],
  } as unknown as PokeData;
}

function makeRunner(initialNames: string[]) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: PokeData, useValue: stubPoke([...initialNames, 'pikachu']) }],
  });
  const game = TestBed.inject(Game);
  for (const n of initialNames) game.add(n, 1);
  game.setSquad(initialNames.slice(0, 6));
  const runner = TestBed.inject(MatchRunner);
  return { game, runner };
}

describe('MatchRunner', () => {
  it('pays out only once per match (no infinite collect)', async () => {
    const { game, runner } = makeRunner(['bulbasaur', 'charmander', 'squirtle']);

    await runner.play(['pikachu']);
    const coinsBefore = game.coins();
    const winsBefore = game.wins();

    runner.collect();
    runner.collect(); // repeated click must be a no-op
    runner.collect();

    expect(game.coins()).toBeGreaterThan(coinsBefore);
    expect(game.coins()).toBe(coinsBefore + 10 + game.tier() * 2);
    expect(game.wins()).toBe(winsBefore + 1);
  });

  it('summarizes damage and fainted per side', async () => {
    const { runner } = makeRunner(['bulbasaur', 'charmander', 'squirtle']);

    await runner.play(['pikachu']);
    const s = runner.summary();
    expect(s).not.toBeNull();
    expect(['player', 'rival']).toContain(s!.winner);
    expect(s!.playerDamage).toBeGreaterThanOrEqual(0);
    expect(s!.rivalDamage).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(s!.playerLost)).toBe(true);
    expect(Array.isArray(s!.rivalLost)).toBe(true);
  });

  it('carries the owned level into player fighters', async () => {
    const { runner } = makeRunner(['bulbasaur', 'charmander', 'squirtle']);

    await runner.play(['pikachu']);
    expect(runner.player().length).toBeGreaterThan(0);
    for (const f of runner.player()) {
      expect(f.fighter.level).toBeGreaterThan(1); // level + owned level, not flat Lv 1
    }
  });
});
