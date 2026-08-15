/**
 * One narrated moment of a battle — the shared contract between the battle
 * simulators (`@poke/battle`, `@poke/manual-battle`) and the `battle-log` UI.
 * Lives in `shared/models` so shared components never import from feature code.
 */
export interface BattleEvent {
  text: string;
  /** Damage dealt by the attacker this tick (0 for buffs/misses). */
  damage: number;
  /** Attacker name. */
  from: string;
  /** Target name. */
  to: string;
  /** Set when this event knocks out the target. */
  ko?: boolean;
  /** Move type used (for type effectiveness display). */
  type?: string;
  /** Type effectiveness multiplier (0, 0.5, 1, 2). */
  effectiveness?: number;
}
