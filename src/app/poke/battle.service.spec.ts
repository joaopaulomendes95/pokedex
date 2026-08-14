import { describe, expect, it } from 'vitest';
import { Battle, buildFighter } from '@poke/battle';
import { BattleTeam, Fighter, FighterMove } from '@poke/poke.model';

function fighter(
  name: string,
  hp: number,
  attack: number,
  defense: number,
  speed: number,
  types: string[],
  moves: FighterMove[] = [],
): Fighter {
  return {
    name,
    spriteUrl: '',
    maxHp: hp,
    hp,
    attack,
    defense,
    spAtk: attack,
    spDef: defense,
    speed,
    types,
    moves,
  };
}

function team(name: string, fighters: Fighter[]): BattleTeam {
  return { name, fighters };
}

describe('buildFighter', () => {
  it('scales stats by level', () => {
    const f = buildFighter(
      'pikachu',
      '',
      ['electric'],
      { hp: 35, attack: 55, defense: 40, spAtk: 50, spDef: 50, speed: 90 },
      10,
    );
    expect(f.hp).toBeGreaterThan(35);
    expect(f.attack).toBeGreaterThan(55);
    expect(f.maxHp).toBe(f.hp);
  });
});

describe('Battle.simulate', () => {
  const service = new Battle();
  const seq =
    (v: number): (() => number) =>
    () =>
      v;

  it('favours the faster lead', () => {
    const a = fighter('speedy', 100, 10, 1, 90, ['normal']);
    const b = fighter('slow', 100, 10, 1, 1, ['normal']);
    const res = service.simulate(team('a', [a]), team('b', [b]), seq(0.5));
    expect(res.winner).toBe('player');
  });

  it('produces at least one hit event and a winner', () => {
    const a = fighter('a', 100, 10, 5, 50, ['fire']);
    const b = fighter('b', 100, 10, 5, 40, ['water']);
    const res = service.simulate(team('a', [a]), team('b', [b]), () => 0.5);
    expect(res.events.length).toBeGreaterThan(0);
    expect(['player', 'rival']).toContain(res.winner);
  });

  it('crowns the side that outlasts a full list', () => {
    const a = fighter('tank', 1000, 5, 20, 10, ['normal']);
    const b1 = fighter('weak', 1, 1, 1, 10, ['normal']);
    const b2 = fighter('weak', 1, 1, 1, 10, ['normal']);
    const res = service.simulate(team('a', [a]), team('b', [b1, b2]), () => 0.5);
    expect(res.winner).toBe('player');
  });

  it('applies the type chart (fire beats grass)', () => {
    const fire = fighter('f', 100, 10, 1, 50, ['fire']);
    const grass = fighter('g', 10, 1, 1, 40, ['grass']);
    const res = service.simulate(team('a', [fire]), team('b', [grass]), () => 0.5);
    expect(res.winner).toBe('player');
    // fire vs grass = super effective events expected at least once
    expect(res.events.some((e) => e.text.includes('super effective'))).toBe(true);
  });

  it('ghost vs normal deals no effect', () => {
    const ghost = fighter('gh', 100, 10, 1, 50, ['ghost']);
    const normal = fighter('n', 100, 1, 1, 40, ['normal']);
    const res = service.simulate(team('a', [ghost]), team('b', [normal]), () => 0.5);
    expect(res.events.some((e) => e.text.includes('no effect'))).toBe(true);
  });

  it('narrates the real move name from the moveset', () => {
    const a = fighter(
      'attacker',
      100,
      20,
      5,
      90,
      ['fire'],
      [{ name: 'Ember', type: 'fire', category: 'physical', power: 40 }],
    );
    const b = fighter('defender', 100, 5, 5, 1, ['grass']);
    const res = service.simulate(team('a', [a]), team('b', [b]), () => 0.5);
    expect(res.events.some((e) => e.text.includes('Ember'))).toBe(true);
  });

  it('applies STAB — same-type moves hit harder', () => {
    const a = fighter(
      'attacker',
      100,
      20,
      5,
      90,
      ['fire'],
      [
        { name: 'Ember', type: 'fire', category: 'physical', power: 40 },
        { name: 'Scratch', type: 'normal', category: 'physical', power: 40 },
      ],
    );
    const b = fighter('defender', 100, 5, 5, 1, ['grass']);
    const res = service.simulate(team('a', [a]), team('b', [b]), () => 0.5);
    // Ember (fire, STAB + super-effective) is picked over Scratch every time.
    expect(res.events.some((e) => e.text.includes('Ember'))).toBe(true);
    expect(res.events.some((e) => e.text.includes('Scratch'))).toBe(false);
  });

  it('prefers the super-effective move of the moveset', () => {
    const a = fighter(
      'attacker',
      100,
      20,
      5,
      90,
      ['fire'],
      [
        { name: 'Ember', type: 'fire', category: 'physical', power: 40 },
        { name: 'Scratch', type: 'normal', category: 'physical', power: 60 },
      ],
    );
    const b = fighter('defender', 100, 5, 5, 1, ['grass']);
    const res = service.simulate(team('a', [a]), team('b', [b]), () => 0.5);
    // Ember (2x vs grass) out-scores Scratch (1x) despite lower power.
    expect(res.events.filter((e) => e.text.includes('Ember')).length).toBeGreaterThan(0);
    expect(res.events.filter((e) => e.text.includes('Scratch')).length).toBe(0);
  });
});
