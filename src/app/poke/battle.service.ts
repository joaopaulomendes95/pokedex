import { Service } from '@angular/core';
import { BattleEvent, BattleResult, BattleTeam, Fighter } from '@poke/poke.model';
import { typeMultiplier } from '@poke/type-chart';

/** Scales raw base stats to a battle-ready fighter at `level`. */
export function buildFighter(
  name: string,
  spriteUrl: string,
  types: string[],
  base: {
    hp: number;
    attack: number;
    defense: number;
    spAtk: number;
    spDef: number;
    speed: number;
  },
  level: number,
): Fighter {
  const scale = (v: number) => Math.max(1, Math.round(v * levelScale(level)));
  return {
    name,
    spriteUrl,
    types,
    level,
    maxHp: scale(base.hp),
    hp: scale(base.hp),
    attack: scale(base.attack),
    defense: scale(base.defense),
    spAtk: scale(base.spAtk),
    spDef: scale(base.spDef),
    speed: scale(base.speed),
  };
}

/** Level multiplier for stats (exported so UI can show scaled stats too). */
export function levelScale(level: number): number {
  return 0.5 + level * 0.09;
}

type Side = 'player' | 'rival';
type Rng = () => number;

type MoveCategory = 'physical' | 'special';

interface Move {
  category: MoveCategory;
  type: string;
  power: number;
}

/** Chooses the best move category (physical vs special) for an attacker vs defender. */
function chooseMove(attacker: Fighter, defender: Fighter, rng: Rng): Move {
  const physicalPower = attacker.attack / Math.max(1, defender.defense);
  const specialPower = attacker.spAtk / Math.max(1, defender.spDef);
  const useSpecial = specialPower > physicalPower;

  const types = attacker.types.length ? attacker.types : ['normal'];
  const type = types[Math.floor(rng() * types.length)];

  return {
    category: useSpecial ? 'special' : 'physical',
    type,
    power: useSpecial ? attacker.spAtk : attacker.attack,
  };
}

/**
 * Turn-based battle sim. `simulate` is a PURE function (same rng → same
 * output) so it is fully unit-testable.
 *
 * Rules:
 *  - the lead with more speed attacks first each round (tie → rng);
 *  - attacker chooses physical or special based on which does more damage;
 *  - damage = basePower * (atk/def) * variance(0.85–1.15) * typeMultiplier;
 *  - a faint promotes the next fighter of that side and they keep fighting
 *    within the same round;
 *  - first side whose whole list is down loses.
 */
@Service()
export class BattleService {
  simulate(player: BattleTeam, rival: BattleTeam, rng: Rng = Math.random): BattleResult {
    const p = player.fighters.map((f) => ({ ...f }));
    const r = rival.fighters.map((f) => ({ ...f }));
    const events: BattleEvent[] = [];

    if (p.length === 0 || r.length === 0) {
      events.push({ text: 'A side walked in with no fighters!', damage: 0, from: '—', to: '—' });
      return { winner: p.length ? 'player' : 'rival', events };
    }

    let pi = 0;
    let ri = 0;

    while (pi < p.length && ri < r.length) {
      const pa = p[pi];
      const ra = r[ri];
      const paFirst = pa.speed > ra.speed || (pa.speed === ra.speed && rng() < 0.5);

      if (paFirst) {
        if (exchange(pa, ra, 'player', events, rng)) {
          events.push(faintEvent(ra));
          ri++;
          if (ri >= r.length) break;
        }
        if (exchange(ra, pa, 'rival', events, rng)) {
          events.push(faintEvent(pa));
          pi++;
        }
      } else {
        if (exchange(ra, pa, 'rival', events, rng)) {
          events.push(faintEvent(pa));
          pi++;
          if (pi >= p.length) break;
        }
        if (exchange(pa, ra, 'player', events, rng)) {
          events.push(faintEvent(ra));
          ri++;
        }
      }
    }

    const winner: Side = pi >= p.length ? 'rival' : 'player';
    return { winner, events };
  }
}

/** One attacker strikes the defender. Returns true if defender fainted. */
function exchange(
  attacker: Fighter,
  defender: Fighter,
  actor: Side,
  events: BattleEvent[],
  rng: Rng,
): boolean {
  const move = chooseMove(attacker, defender, rng);
  const defStat = move.category === 'physical' ? defender.defense : defender.spDef;
  const defTypes = defender.types.length ? defender.types : ['normal'];
  const mul = typeMultiplier(move.type, defTypes);
  const variance = 0.85 + rng() * 0.3;
  const base = 10 * (move.power / Math.max(1, defStat)) * variance * mul;
  const damage = Math.max(1, Math.round(base));

  defender.hp = Math.max(0, defender.hp - damage);

  const effectiveness =
    mul <= 0
      ? 'no effect'
      : mul >= 2
        ? 'super effective!'
        : mul <= 0.5
          ? 'not very effective...'
          : 'hit';
  const categoryLabel = move.category === 'special' ? 'special' : 'physical';

  events.push({
    text: `${attacker.name} used a ${categoryLabel} ${move.type} move — ${effectiveness}`,
    damage,
    from: actor,
    to: actor === 'player' ? 'rival' : 'player',
    ko: defender.hp === 0,
    type: move.type,
    effectiveness: mul,
  });
  return defender.hp === 0;
}

function faintEvent(f: Fighter): BattleEvent {
  return { text: `${f.name} fainted!`, damage: 0, from: '—', to: '—', ko: true };
}
