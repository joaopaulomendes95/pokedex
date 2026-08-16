import { BattleResult, BattleTeam, Fighter, FighterMove } from '@poke/poke.model';
import { typeMultiplier } from '@poke/type-chart';
import { BattleEvent } from '@shared/models/battle-event';

/** Stat bonus per star on an ascended (duplicate-fed) pokémon. */
export const STAR_STAT_BONUS = 0.08;
/** Stat bonus for single-stage (no-evolution) pokémon — they can't evolve. */
export const APEX_STAT_BONUS = 0.08;

/** Scales raw base stats to a battle-ready fighter at `level` (plus stars). */
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
  moves: FighterMove[] = [],
  stars = 0,
  apex = false,
): Fighter {
  const scale = (v: number) =>
    Math.max(
      1,
      Math.round(
        v * levelScale(level) * (1 + STAR_STAT_BONUS * stars) * (1 + (apex ? APEX_STAT_BONUS : 0)),
      ),
    );
  return {
    name,
    spriteUrl,
    types,
    level,
    moves,
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
  name: string;
  category: MoveCategory;
  type: string;
  power: number;
}

/** Generic fallback attack when a fighter has no real moves cached. */
function fallbackMove(attacker: Fighter, rng: Rng): Move {
  const types = attacker.types.length ? attacker.types : ['normal'];
  const type = types[Math.floor(rng() * types.length)]!;
  const useSpecial = attacker.spAtk > attacker.attack;
  return {
    name: `${type} attack`,
    category: useSpecial ? 'special' : 'physical',
    type,
    power: useSpecial ? attacker.spAtk : attacker.attack,
  };
}

/**
 * Picks the best real move from the fighter's moveset: prefer the move that
 * is super-effective against the defender (via the type chart), then the
 * highest power, with a small random tiebreak. Falls back to a generic
 * attack when no real moves are available.
 */
export function chooseMove(attacker: Fighter, defender: Fighter, rng: Rng): Move {
  const moves = attacker.moves.length ? attacker.moves : [fallbackMove(attacker, rng)];
  const defTypes = defender.types.length ? defender.types : ['normal'];
  let best = moves[0]!;
  let bestScore = -Infinity;
  for (const m of moves) {
    const mult = typeMultiplier(m.type, defTypes);
    const score = mult * 1000 + m.power + rng() * 10;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return { name: best.name, category: best.category, type: best.type, power: best.power };
}

/** One attacker strikes the defender. Pure: neither fighter is mutated. */
export interface ExchangeResult {
  event: BattleEvent;
  damage: number;
  fainted: boolean;
}

export function resolveExchange(
  attacker: Fighter,
  defender: Fighter,
  move: Move,
  actor: Side,
  rng: Rng,
): ExchangeResult {
  const defStat = move.category === 'physical' ? defender.defense : defender.spDef;
  const defTypes = defender.types.length ? defender.types : ['normal'];
  const mul = typeMultiplier(move.type, defTypes);
  // STAB: same-type attack bonus — an attacker hitting with its own type
  // deals 20% more damage (the classic Pokémon mechanic).
  const stab = attacker.types.includes(move.type) ? 1.2 : 1;
  const variance = 0.85 + rng() * 0.3;
  const base = 10 * (move.power / Math.max(1, defStat)) * variance * mul * stab;
  const damage = Math.max(1, Math.round(base));
  const fainted = defender.hp - damage <= 0;

  const effectiveness =
    mul <= 0
      ? 'no effect'
      : mul >= 2
        ? 'super effective!'
        : mul <= 0.5
          ? 'not very effective...'
          : 'hit';

  return {
    event: {
      text: `${attacker.name} used ${move.name} — ${effectiveness}`,
      damage,
      from: actor,
      to: actor === 'player' ? 'rival' : 'player',
      ko: fainted,
      type: move.type,
      effectiveness: mul,
    },
    damage,
    fainted,
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
export class Battle {
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
      // Indices are guaranteed valid by the loop condition above.
      const pa = p[pi]!;
      const ra = r[ri]!;
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
  const res = resolveExchange(attacker, defender, move, actor, rng);
  defender.hp = Math.max(0, defender.hp - res.damage);
  events.push(res.event);
  return res.fainted;
}

function faintEvent(f: Fighter): BattleEvent {
  return { text: `${f.name} fainted!`, damage: 0, from: '—', to: '—', ko: true };
}
