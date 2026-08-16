import { computed, inject, signal, Service } from '@angular/core';
import { BattleResult, Fighter, PokeDetail } from '@poke/poke.model';
import { Battle, buildFighter, SYNERGY_MIN, SYNERGY_MULT } from '@poke/battle';
import { Game } from '@poke/game';
import { PokeData } from '@poke/poke-data';
import { Summon, FRAGMENTS_PER_WIN } from '@poke/summon';

/** A creature pinned into battle with its live fighter copy. */
export interface ArenaFighter {
  name: string;
  fighter: Fighter;
  detail: PokeDetail;
}

/** One-line post-match recap for the arena screen. */
export interface MatchSummary {
  winner: 'player' | 'rival';
  playerDamage: number;
  rivalDamage: number;
  rounds: number;
  playerLost: string[];
  rivalLost: string[];
}

/**
 * Wraps the pure `Battle.simulate` for the live arena.
 *
 * Battle is INSTANT: no narration tape, no timers — run `play()`, read the
 * `result()`, then `collect()` once. A `settled` guard stops the reward from
 * being farmed by repeated clicks.
 */
@Service()
export class MatchRunner {
  player = signal<ArenaFighter[]>([]);
  rival = signal<ArenaFighter[]>([]);
  result = signal<BattleResult | null>(null);
  /** True once the spoils of the current match have been collected. */
  #_settled = signal(false);
  #_busy = signal(false);
  readonly settled = this.#_settled.asReadonly();
  readonly busy = this.#_busy.asReadonly();

  summary = computed<MatchSummary | null>(() => {
    const res = this.result();
    if (!res) return null;
    let playerDamage = 0;
    let rivalDamage = 0;
    const fainted: string[] = [];
    for (const ev of res.events) {
      if (ev.from === 'player') playerDamage += ev.damage;
      else if (ev.from === 'rival') rivalDamage += ev.damage;
      if (ev.ko) fainted.push(ev.text.replace(' fainted!', ''));
    }
    const playerNames = this.player().map((f) => f.name);
    return {
      winner: res.winner,
      playerDamage,
      rivalDamage,
      rounds: res.events.filter((e) => e.ko).length,
      playerLost: fainted.filter((n) => playerNames.includes(n)),
      rivalLost: fainted.filter((n) => !playerNames.includes(n)),
    };
  });

  #game = inject(Game);
  #poke = inject(PokeData);
  #summon = inject(Summon);

  /** Builds and resolves a match between the current squad and rival names.
   *  Returns the result immediately (the `result()` signal still updates for
   *  the template). */
  async play(
    rivalNames: string[],
    rivalLevel?: number,
    playerSquad?: string[],
    levelCap?: number,
  ): Promise<BattleResult> {
    this.#_busy.set(true);
    this.result.set(null);
    this.#_settled.set(false);

    const squad = playerSquad ?? this.#game.squad();
    try {
      await this.#poke.ensureInCache([...squad, ...rivalNames]);
    } catch {
      // Detail warmup is best-effort — the sim can still fall back.
    }
    // Real move details drive the sim — resolve them (best-effort; the sim
    // falls back to generic attacks when a move fetch fails).
    try {
      await this.#poke.ensureMoves([...squad, ...rivalNames]);
    } catch {
      /* move warmup is best-effort */
    }

    const playerTeam = this.spawn(squad, this.#game.tier() + 1, false, levelCap);
    const level = rivalLevel ?? this.#game.tier() + 3;
    const rivalTeam = this.spawn(rivalNames, level, true);

    this.player.set(playerTeam);
    this.rival.set(rivalTeam);

    const battle = new Battle();
    const res = battle.simulate(
      { name: 'You', fighters: playerTeam.map((f) => f.fighter) },
      { name: 'Rivals', fighters: rivalTeam.map((f) => f.fighter) },
    );
    this.result.set(res);
    this.#_busy.set(false);
    // Fighters earn a personal XP boost for showing up (on top of squad XP).
    if (res.winner === 'player') {
      for (const f of playerTeam) {
        this.#game.grantXp(f.name, 8 + this.#game.tier() * 2);
      }
    }
    return res;
  }

  /** Whether the current match has been resolved but not yet collected. */
  canCollect = computed(() => this.result() !== null && !this.settled());

  /** Payout once per finished match. */
  collect() {
    const res = this.result();
    if (!res || this.settled()) return;
    this.#_settled.set(true);
    this.#game.award(res.winner);
    if (res.winner === 'player') {
      this.#game.promote();
      this.#summon.addFragments(FRAGMENTS_PER_WIN);
    }
  }

  /** Build battle-ready teams for the given names (public for the manual mode). */
  spawn(names: string[], level: number, isRival: boolean, levelCap?: number): ArenaFighter[] {
    // Squad synergy (player only): 3+ fighters sharing a primary type boost
    // each other (the Raid-style faction bonus).
    const typeCounts = new Map<string, number>();
    if (!isRival) {
      for (const n of names) {
        const t = this.#poke.pokeByName(n)?.types?.[0];
        if (t) typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
      }
    }
    return names
      .map((name): ArenaFighter | null => {
        const detail = this.#poke.pokeByName(name);
        if (!detail) return null;
        const owned = isRival ? undefined : this.#game.own(name);
        const ownedLevel = owned?.level ?? 0;
        const finalLevel = levelCap ? Math.min(level + ownedLevel, levelCap) : level + ownedLevel;
        const primary = detail.types[0];
        const synergy = primary && (typeCounts.get(primary) ?? 0) >= SYNERGY_MIN ? SYNERGY_MULT : 1;
        return {
          name,
          detail,
          fighter: buildFighter(
            name,
            detail.spriteUrl,
            detail.types,
            {
              hp: detail.stats.hp,
              attack: detail.stats.attack,
              defense: detail.stats.defense,
              spAtk: detail.stats.spAtk,
              spDef: detail.stats.spDef,
              speed: detail.stats.speed,
            },
            finalLevel,
            this.#poke.movesFor(name),
            owned?.stars ?? 0,
            !isRival && this.#poke.isApex(name),
            synergy,
          ),
        };
      })
      .filter((f): f is ArenaFighter => f !== null);
  }
}
