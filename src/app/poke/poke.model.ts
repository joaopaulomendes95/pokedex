/** A single entry in PokeAPI's paginated `/pokemon` list. */
export interface PokeId {
  name: string;
  url: string;
}

/** A real ability a species can have (from the detail body — no extra request). */
export interface PokeAbility {
  name: string;
  isHidden: boolean;
}

/** Full detail from PokeAPI `/pokemon/:name` (what we render in the dex). */
export interface PokeDetail {
  id: number;
  name: string;
  types: string[];
  stats: PokeStats;
  spriteUrl: string;
  artworkUrl: string;
  /** base experience from the API — drives catch difficulty. */
  baseExperience: number;
  /** Real level-up moveset: name + level learned (newest version group, capped). */
  moves: { name: string; level: number }[];
  /** Real abilities, hidden flag included. */
  abilities: PokeAbility[];
}

export interface PokeStats {
  hp: number;
  attack: number;
  defense: number;
  /** special-attack */
  spAtk: number;
  /** special-defense */
  spDef: number;
  speed: number;
}

/** A location-area returned by the pokedex `map` (a place you can explore). */
export interface PokeLocation {
  name: string;
  url: string;
}

/** Full `/location-area/:name` payload (who wanders around there). */
export interface LocationArea {
  name: string;
  pokemon_encounters: { pokemon: { name: string; url: string } }[];
}

/** A creature you own, levelled through battles. */
export interface OwnedPoke {
  name: string;
  level: number;
  xp: number;
  /** Shiny variant (caught with a low roll — renders the shiny sprite). */
  shiny?: boolean;
}

/** A real move a fighter can use in battle (from PokeAPI `/move/:name`). */
export interface FighterMove {
  name: string;
  type: string;
  category: 'physical' | 'special';
  power: number;
}

/** A battle-ready fighter with scaled stats. */
export interface Fighter {
  name: string;
  spriteUrl: string;
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  spAtk: number;
  spDef: number;
  speed: number;
  types: string[];
  /** Real moves known by this fighter (drives the battle sim). */
  moves: FighterMove[];
  /** Display level (used to show "Lv N" in the arena). Optional: sim ignores it. */
  level?: number;
}

/** One narrated moment of a battle. */
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

export interface BattleResult {
  winner: 'player' | 'rival';
  events: BattleEvent[];
}

export interface BattleTeam {
  name: string;
  fighters: Fighter[];
}

export interface TierDef {
  name: string;
  /** Coins earned per real second while not fighting. */
  idleCoinsPerSec: number;
  /** Win a match in this league required to promote. */
  winsToPromote: number;
  /** Scalar applied to rival levels. */
  rivalLevel: number;
}
