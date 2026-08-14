import { computed, signal, Service } from '@angular/core';
import { BattleEvent, Fighter, FighterMove } from '@poke/poke.model';
import { chooseMove, resolveExchange } from '@poke/battle';

/**
 * Player-controlled, turn-by-turn battle (the "real Pokémon game" mode).
 *
 * Each round the player picks one of their pokémon's real moves; both sides
 * strike (initiative by speed, like the sim) and the damage comes from the
 * same formula + type chart as `Battle.simulate`. Hp is applied immutably so
 * the signals re-render the bars.
 */
@Service()
export class ManualBattle {
  #_player = signal<Fighter[]>([]);
  #_rival = signal<Fighter[]>([]);
  readonly player = this.#_player.asReadonly();
  readonly rival = this.#_rival.asReadonly();

  #_playerIndex = signal(0);
  #_rivalIndex = signal(0);
  #_round = signal(1);
  #_log = signal<BattleEvent[]>([]);
  #_winner = signal<'player' | 'rival' | null>(null);

  readonly playerIndex = this.#_playerIndex.asReadonly();
  readonly rivalIndex = this.#_rivalIndex.asReadonly();
  readonly round = this.#_round.asReadonly();
  readonly log = this.#_log.asReadonly();
  readonly winner = this.#_winner.asReadonly();

  readonly active = computed(() => this.#_player().length > 0);
  readonly playerFighter = computed(() => this.#_player()[this.#_playerIndex()]);
  readonly rivalFighter = computed(() => this.#_rival()[this.#_rivalIndex()]);

  /** Whether the player can act right now. */
  readonly canAct = computed(
    () =>
      !this.#_winner() &&
      Boolean(this.playerFighter() && this.rivalFighter()) &&
      (this.playerFighter()?.hp ?? 0) > 0 &&
      (this.rivalFighter()?.hp ?? 0) > 0,
  );

  /** Start a fresh manual battle (fighter lists are copied). */
  start(playerTeam: Fighter[], rivalTeam: Fighter[]) {
    this.#_player.set(playerTeam.map((f) => ({ ...f })));
    this.#_rival.set(rivalTeam.map((f) => ({ ...f })));
    this.#_playerIndex.set(0);
    this.#_rivalIndex.set(0);
    this.#_round.set(1);
    this.#_log.set([]);
    this.#_winner.set(null);
  }

  quit() {
    this.#_player.set([]);
    this.#_rival.set([]);
    this.#_winner.set(null);
  }

  /** The player picks a move; both sides strike. Returns the round's events. */
  playRound(move: FighterMove): BattleEvent[] {
    if (!this.canAct()) return [];
    const events: BattleEvent[] = [];

    const p = this.playerFighter()!;
    const r = this.rivalFighter()!;
    const playerFirst = p.speed >= r.speed;

    const strike = (
      attacker: Fighter,
      defender: Fighter,
      chosen: FighterMove,
      actor: 'player' | 'rival',
    ) => {
      const res = resolveExchange(attacker, defender, chosen, actor, Math.random);
      // The damage lands on the defender, i.e. the opposite side of the actor.
      this.applyDamage(actor === 'player' ? 'rival' : 'player', res.damage);
      events.push(res.event);
      if (res.fainted) {
        // The DEFENDER fainted — advance that side; when the battle is over, stop.
        if (this.advanceAfterFaint(actor === 'player' ? 'rival' : 'player')) return true;
      }
      return false;
    };

    if (playerFirst) {
      if (strike(p, r, move, 'player')) {
        this.#_round.update((n) => n + 1);
        return events;
      }
      strike(r, p, chooseMove(r, p, Math.random), 'rival');
    } else {
      if (strike(r, p, chooseMove(r, p, Math.random), 'rival')) {
        this.#_round.update((n) => n + 1);
        return events;
      }
      strike(p, r, move, 'player');
    }

    this.#_round.update((n) => n + 1);
    this.#_log.update((log) => [...log, ...events]);
    return events;
  }

  /** Apply damage immutably to the given side's active fighter. */
  private applyDamage(side: 'player' | 'rival', damage: number) {
    const target = side === 'player' ? this.#_player : this.#_rival;
    const idx = side === 'player' ? this.#_playerIndex() : this.#_rivalIndex();
    target.update((arr) =>
      arr.map((f, i) => (i === idx ? { ...f, hp: Math.max(0, f.hp - damage) } : f)),
    );
  }

  /** After a faint, advance that side; returns true when the battle is over. */
  private advanceAfterFaint(side: 'player' | 'rival'): boolean {
    if (side === 'player') {
      const next = this.#_playerIndex() + 1;
      if (next >= this.#_player().length) {
        this.#_winner.set('rival');
        return true;
      }
      this.#_playerIndex.set(next);
    } else {
      const next = this.#_rivalIndex() + 1;
      if (next >= this.#_rival().length) {
        this.#_winner.set('player');
        return true;
      }
      this.#_rivalIndex.set(next);
    }
    return false;
  }
}
