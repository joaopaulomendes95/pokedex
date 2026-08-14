import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ManualBattle } from '@poke/manual-battle';
import { Fighter, FighterMove } from '@poke/poke.model';

function fighter(
  name: string,
  hp: number,
  attack: number,
  defense: number,
  speed: number,
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
    types: ['normal'],
    moves,
  };
}

const TACKLE: FighterMove = { name: 'tackle', type: 'normal', category: 'physical', power: 40 };

describe('ManualBattle', () => {
  function make() {
    TestBed.configureTestingModule({});
    return TestBed.inject(ManualBattle);
  }

  it('resolves a round and logs events', () => {
    const m = make();
    m.start(
      [fighter('bulbasaur', 100, 20, 10, 60, [TACKLE])],
      [fighter('rattata', 80, 10, 5, 40, [TACKLE])],
    );
    expect(m.canAct()).toBe(true);

    const events = m.playRound(TACKLE);
    expect(events.length).toBeGreaterThan(0);
    expect(m.round()).toBe(2);
    // The rival took damage (player is faster).
    expect(m.rivalFighter()!.hp).toBeLessThan(80);
  });

  it('crowns the player when the whole rival team faints', () => {
    const m = make();
    m.start(
      [fighter('mewtwo', 9999, 200, 200, 200, [TACKLE])],
      [fighter('weak1', 1, 1, 1, 1, [TACKLE]), fighter('weak2', 1, 1, 1, 1, [TACKLE])],
    );
    let guard = 0;
    while (m.canAct() && guard++ < 50) {
      m.playRound(TACKLE);
    }
    expect(m.winner()).toBe('player');
    expect(m.canAct()).toBe(false);
  });

  it('advances the player index after their pokémon faints', () => {
    const m = make();
    m.start(
      [fighter('glass', 10, 1, 1, 200, [TACKLE]), fighter('tank', 500, 50, 50, 50, [TACKLE])],
      [fighter('monster', 500, 200, 200, 10, [TACKLE])],
    );
    let guard = 0;
    while (m.canAct() && guard++ < 50) {
      m.playRound(TACKLE);
    }
    expect(m.playerIndex()).toBeGreaterThan(0);
  });

  it('quit clears the battle', () => {
    const m = make();
    m.start([fighter('a', 100, 10, 10, 50, [TACKLE])], [fighter('b', 100, 10, 10, 50, [TACKLE])]);
    m.quit();
    expect(m.active()).toBe(false);
    expect(m.winner()).toBeNull();
  });
});
