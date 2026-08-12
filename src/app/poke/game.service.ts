import { computed, inject, signal, Service } from '@angular/core';
import { OwnedPoke, TierDef } from '@poke/poke.model';
import { xpForLevel } from '@poke/economy';
import { GenerationFilterService } from '@poke/generation-filter.service';
import { StorageService } from '@core/services/storage.service';
import { GAME_CONFIG, DEFAULT_GAME_CONFIG } from '@core/config/game.config';

export const TIERS: TierDef[] = [
  { name: 'Novice', idleCoinsPerSec: 1, winsToPromote: 3, rivalLevel: 1 },
  { name: 'Semi-Pro', idleCoinsPerSec: 2, winsToPromote: 3, rivalLevel: 3 },
  { name: 'Pro League', idleCoinsPerSec: 4, winsToPromote: 4, rivalLevel: 6 },
  { name: 'Elite', idleCoinsPerSec: 7, winsToPromote: 4, rivalLevel: 9 },
  { name: 'Champion Cup', idleCoinsPerSec: 10, winsToPromote: 5, rivalLevel: 12 },
];

const STORAGE_KEY = 'poke-league-save';
/** The localStorage key the whole save lives under (shown on the Save tab). */
export const SAVE_KEY = STORAGE_KEY;
/** Cap for offline/idle coins earned while the tab is closed (hours). */
export const OFFLINE_CAP_MS = DEFAULT_GAME_CONFIG.offlineCapMs;
/** Max creatures concurrently fielded in the arena. */
export const SQUAD_MAX = DEFAULT_GAME_CONFIG.squadMax;
/** Default generation for a brand-new save. */
const DEFAULT_GEN = 2;
/** Squad energy: gates cup battles and makes consumables useful. */
export const ENERGY_MAX = DEFAULT_GAME_CONFIG.energyMax;
/** Energy regenerated per real second (full in ~10 min). */
export const ENERGY_REGEN_PER_SEC = DEFAULT_GAME_CONFIG.energyRegenPerSec;
const STARTING_POKE = DEFAULT_GAME_CONFIG.startingPoke; /** What each consumable restores (id → energy, minus balls). */
export const CONSUMABLE_ENERGY: Record<string, number> = {
  potion: 20,
  superpotion: 40,
  hyperpotion: 60,
  energydrink: 50,
  revive: ENERGY_MAX,
};

/** Ball multipliers applied to the catch chance by tier. */
export const BALL_CATCH_MULT: Record<string, number> = {
  pokeball: 1,
  greatball: 1.5,
  ultraball: 2,
};

interface SaveState {
  coins: number;
  collection: OwnedPoke[];
  squad: string[];
  wins: number;
  tier: number;
  visited: string[];
  inventory: Record<string, number>;
  energy: number;
  maxGen: number;
  prestige: number;
  stats: CareerStats;
  savedAt: number;
}

/** Lifetime counters that back the mission/quest system. */
export interface CareerStats {
  battles: number;
  wins: number;
  catches: number;
  coinsEarned: number;
  levelUps: number;
}

/** Fresh career counters for a brand-new run. */
const FRESH_STATS: CareerStats = { battles: 0, wins: 0, catches: 0, coinsEarned: 0, levelUps: 0 };

/** Coins earned per owned creature, per second (collection-scaled income). */
const COINS_PER_ROSTER = 0.15;
/** Extra passive XP per second per owned creature. */
const XP_PER_ROSTER = 0.1;
/** Income multiplier granted per prestige shard (permanent). */
const PRESTIGE_INCOME_MULT = 0.25;
/** Passive XP bonus per prestige shard. */
const PRESTIGE_XP_BONUS = 1;

/** Idle economy + collection + ladder, persisted to localStorage. */
@Service()
export class GameService {
  coins = signal(0);
  collection = signal<Map<string, OwnedPoke>>(new Map());
  squad = signal<string[]>([]);
  wins = signal(0);
  tier = signal(0);
  /** Location-area URLs the player has explored (unlocks Adventure regions). */
  visited = signal<string[]>([]);
  /** Shop item id → count the player owns. */
  inventory = signal<Record<string, number>>({});
  /** Squad energy 0..ENERGY_MAX — cups cost it, potions refill it. */
  energy = signal(100);
  /** Permanent prestige shards earned from resetting a finished run. */
  prestige = signal(0);
  /** Lifetime career counters that drive missions. */
  stats = signal<CareerStats>({ ...FRESH_STATS });

  /** Whole-number energy for display. */
  energyInt = computed(() => Math.floor(this.energy()));
  /** 0..100 percent for a bar. */
  energyPct = computed(() => Math.floor((this.energy() / this.config.energyMax) * 100));

  /** Free XP every owned pokémon banks per real second (idle grind). */
  passiveXpPerSec = computed(() => 1 + this.tier() + XP_PER_ROSTER * this.roster().length);

  /** Idle coins per second: tier base + per-creature bonus, boosted by prestige. */
  incomePerSec = computed(
    () =>
      (this.tierDef().idleCoinsPerSec + COINS_PER_ROSTER * this.roster().length) *
      (1 + PRESTIGE_INCOME_MULT * this.prestige()),
  );

  tierDef = computed(() => TIERS[this.tier()] ?? TIERS[TIERS.length - 1]);
  winsToPromote = computed(() => this.tierDef().winsToPromote);
  roster = computed(() =>
    [...this.collection().values()].sort(
      (a, b) => b.level - a.level || a.name.localeCompare(b.name),
    ),
  );
  canPromote = computed(
    () => this.tier() < TIERS.length - 1 && this.wins() >= this.winsToPromote(),
  );

  private savedAt = Date.now();
  /** Last persist timestamp as a signal so the Save tab can render it. */
  lastSaved = signal(Date.now());
  private tickIdle: ReturnType<typeof setInterval> | undefined;

  /** Extra per-tick callbacks (AppComponent wires its CD + paint nudge here). */
  private tickHooks: Array<() => void> = [];

  private readonly genFilter = inject(GenerationFilterService);
  private readonly storage = inject(StorageService);
  private readonly config = inject(GAME_CONFIG);

  constructor() {
    this.load();
    if (!this.hasSave) this.seed();
    // Apply offline earnings once, then start the live idle tick.
    this.restoreOffline();
    this.tickIdle = setInterval(() => {
      try {
        this.tick();
      } catch (err) {
        console.error('[game-tick] state update failed', err);
      }
      for (const hook of this.tickHooks) {
        try {
          hook();
        } catch (err) {
          console.error('[game-tick] render hook failed', err);
        }
      }
    }, 1000);
    window.addEventListener('beforeunload', () => this.persist());
  }

  /** Register a callback invoked right after every 1s tick. */
  registerTickHook(fn: () => void): void {
    this.tickHooks.push(fn);
  }

  private hasSave = false;

  /** Fresh-save bag: a few balls to start adventuring. */
  private startingInventory(): Record<string, number> {
    return { pokeball: 5 };
  }

  private seed() {
    for (const name of STARTING_POKE) this.add(name, 1);
    this.inventory.set(this.startingInventory());
    this.energy.set(this.config.energyMax);
    this.genFilter.setMaxGen(DEFAULT_GEN);
    this.persist();
  }

  /** One real second passes: coins accrue, the whole collection banks XP. */
  tick() {
    this.coins.update((c) => c + this.incomePerSec());
    this.stats.update((s) => ({ ...s, coinsEarned: s.coinsEarned + this.incomePerSec() }));
    this.energy.update((e) => Math.min(this.config.energyMax, e + this.config.energyRegenPerSec));
    const xpPerSec = this.passiveXpPerSec();
    if (xpPerSec <= 0) return;
    this.collection.update((map) => {
      if (map.size === 0) return map;
      const next = new Map(map);
      for (const entry of next.values()) entry.xp += xpPerSec;
      return next;
    });
  }

  // ---- Inventory / consumables ----

  itemCount(id: string): number {
    return this.inventory()[id] ?? 0;
  }

  addItem(id: string, amount = 1) {
    this.inventory.update((inv) => ({
      ...inv,
      [id]: (inv[id] ?? 0) + amount,
    }));
    this.persist();
  }

  /** Removes `amount` items; returns false when there aren't enough. */
  consumeItem(id: string, amount = 1): boolean {
    const have = this.itemCount(id);
    if (have < amount) return false;
    this.inventory.update((inv) => ({ ...inv, [id]: have - amount }));
    this.persist();
    return true;
  }

  /**
   * Spends one of the best ball the player owns (ultra > great > plain) and
   * returns its catch multiplier (0 when the bag is empty).
   */
  spendBestBall(): number {
    const order = ['ultraball', 'greatball', 'pokeball'];
    for (const id of order) {
      if (this.itemCount(id) > 0) {
        this.consumeItem(id, 1);
        return BALL_CATCH_MULT[id];
      }
    }
    return 0;
  }

  /**
   * Applies a consumable's energy effect. Returns the energy restored, or -1
   * when the item isn't owned (single fail-fast check keeps the UI honest).
   */
  useConsumable(id: string): number {
    const gain = CONSUMABLE_ENERGY[id];
    if (gain === undefined || !this.consumeItem(id, 1)) return -1;
    this.energy.update((e) => Math.min(this.config.energyMax, e + gain));
    this.persist();
    return gain;
  }

  /** True when `amount` energy is available; also draws it (assumes it happened). */
  spendEnergy(amount: number): boolean {
    const cur = this.energy();
    if (cur < amount) return false;
    this.energy.set(cur - amount);
    return true;
  }

  own(name: string): OwnedPoke | undefined {
    return this.collection().get(name);
  }

  add(name: string, level = 1) {
    this.collection.update((map) => {
      const next = new Map(map);
      next.set(name, { name, level, xp: 0 });
      return next;
    });
    this.persist();
  }

  addLevel(name: string, levels = 1) {
    this.collection.update((map) => {
      const next = new Map(map);
      const cur = next.get(name);
      if (!cur) return map;
      next.set(name, { ...cur, level: cur.level + levels });
      return next;
    });
    this.stats.update((s) => ({ ...s, levelUps: s.levelUps + levels }));
    this.persist();
  }

  grantXp(name: string, amount: number) {
    this.collection.update((map) => {
      const next = new Map(map);
      const cur = next.get(name);
      if (!cur) return map;
      next.set(name, { ...cur, xp: cur.xp + amount });
      return next;
    });
    this.persist();
  }

  /** Levels the pokémon could promote to right now with its banked XP. */
  pendingLevels(name: string): number {
    const cur = this.own(name);
    if (!cur) return 0;
    let { level, xp } = cur;
    let pending = 0;
    while (xp >= xpForLevel(level)) {
      xp -= xpForLevel(level);
      level += 1;
      pending += 1;
    }
    return pending;
  }

  /** 0..100 — progress towards the next level from banked XP. */
  xpPercent(name: string): number {
    const cur = this.own(name);
    if (!cur) return 0;
    const need = xpForLevel(cur.level);
    return Math.min(100, Math.floor((cur.xp / need) * 100));
  }

  /** XP needed to reach next level (integer). */
  xpNeedForLevel(name: string): number {
    const cur = this.own(name);
    if (!cur) return 0;
    return xpForLevel(cur.level);
  }

  /** Current XP (integer). */
  xpCurrent(name: string): number {
    const cur = this.own(name);
    return cur ? cur.xp : 0;
  }

  /** Applies every banked level-up from earned XP at once; true if any applied. */
  applyLevelUps(name: string): boolean {
    const pending = this.pendingLevels(name);
    if (pending <= 0) return false;
    this.collection.update((map) => {
      const next = new Map(map);
      const cur = next.get(name);
      if (!cur) return map;
      let level = cur.level;
      let xp = cur.xp;
      while (xp >= xpForLevel(level)) {
        xp -= xpForLevel(level);
        level += 1;
      }
      next.set(name, { ...cur, level, xp });
      return next;
    });
    this.stats.update((s) => ({ ...s, levelUps: s.levelUps + pending }));
    this.persist();
    return true;
  }

  /** Applies all banked level-ups for ALL owned Pokémon; returns count of Pokémon levelled. */
  applyAllLevelUps(): number {
    let count = 0;
    this.collection.update((map) => {
      const next = new Map(map);
      for (const [name, cur] of next) {
        let level = cur.level;
        let xp = cur.xp;
        let grew = 0;
        while (xp >= xpForLevel(level)) {
          xp -= xpForLevel(level);
          level += 1;
          grew += 1;
        }
        if (grew) {
          next.set(name, { ...cur, level, xp });
          count += grew;
        }
      }
      return next;
    });
    if (count) {
      this.stats.update((s) => ({ ...s, levelUps: s.levelUps + count }));
      this.persist();
    }
    return count;
  }

  setSquad(names: string[]) {
    this.squad.set(names.slice(0, SQUAD_MAX));
    this.persist();
  }

  toggleSquad(name: string) {
    const cur = this.squad();
    if (cur.includes(name)) this.setSquad(cur.filter((n) => n !== name));
    else if (cur.length < SQUAD_MAX) this.setSquad([...cur, name]);
  }

  /** Marks a location-area as explored (idempotent). */
  markVisited(url: string) {
    if (this.visited().includes(url)) return;
    this.visited.update((v) => [...v, url]);
    this.persist();
  }

  award(winner: 'player' | 'rival') {
    this.stats.update((s) => ({
      ...s,
      battles: s.battles + 1,
      wins: s.wins + (winner === 'player' ? 1 : 0),
      coinsEarned: s.coinsEarned + (winner === 'player' ? 10 + this.tier() * 2 : 2),
    }));
    if (winner === 'player') {
      this.coins.update((c) => c + 10 + this.tier() * 2);
      this.wins.update((w) => w + 1);
      for (const name of this.squad()) this.grantXp(name, 5 + this.tier() * 2);
    } else {
      this.coins.update((c) => c + 2);
    }
    this.persist();
  }

  /** Moves up the ladder after a win; returns true when it happened. */
  promote(): boolean {
    if (!this.canPromote()) return false;
    this.tier.update((t) => t + 1);
    this.wins.set(0);
    this.persist();
    return true;
  }

  canAfford(price: number) {
    return this.coins() >= price;
  }

  spend(price: number): boolean {
    if (!this.canAfford(price)) return false;
    this.coins.update((c) => c - price);
    this.persist();
    return true;
  }

  /** Adds coins (prizes, winnings). Never negative. */
  grantCoins(amount: number) {
    if (amount <= 0) return;
    this.coins.update((c) => c + amount);
    this.stats.update((s) => ({ ...s, coinsEarned: s.coinsEarned + amount }));
    this.persist();
  }

  /** Records that the trainer caught a new wild creature (career counter). */
  noteCatch() {
    this.stats.update((s) => ({ ...s, catches: s.catches + 1 }));
    this.persist();
  }

  /** Restart the run: a brand-new save with the chosen generation. */
  reset(gen = DEFAULT_GEN) {
    this.coins.set(0);
    this.collection.set(new Map());
    this.squad.set([]);
    this.wins.set(0);
    this.tier.set(0);
    this.visited.set([]);
    this.inventory.set(this.startingInventory());
    this.energy.set(this.config.energyMax);
    this.genFilter.setMaxGen(Math.max(1, Math.min(9, gen)));
    for (const name of STARTING_POKE) this.add(name, 1);
    this.hasSave = true;
    this.savedAt = Date.now();
    this.persist();
  }

  /** Is a prestige reset available? Requires being at the top of the ladder. */
  canPrestige = computed(() => this.tier() >= TIERS.length - 1);

  /** Shard granted per successful prestige reset. */
  prestigeGain = computed(() => 1 + Math.floor(this.wins() / 5));

  /**
   * Prestige: reset a finished run for a permanent shard (kept across resets).
   * The shard multiplicatively boosts idle income and passive XP forever.
   */
  prestigeReset() {
    if (!this.canPrestige()) return false;
    this.prestige.update((p) => p + this.prestigeGain());
    this.reset();
    return true;
  }

  /** Timestamp of the last persisted save (for display on the Save tab). */
  savedAtMs() {
    return this.savedAt;
  }

  /** Flush the current state to localStorage right now. */
  saveNow() {
    this.persist();
  }

  /** Coins + passive XP earned while the tab slept (never negative). */
  private restoreOffline() {
    const away = Math.min(Math.max(Date.now() - this.savedAt, 0), this.config.offlineCapMs) / 1000;
    const coins = Math.floor(away * TIERS[TIERS.length - 1].idleCoinsPerSec);
    this.coins.update((c) => c + coins);
    this.stats.update((s) => ({ ...s, coinsEarned: s.coinsEarned + coins }));
    const xp = Math.floor(away * (1 + this.tier()));
    if (xp <= 0) return;
    this.collection.update((map) => {
      if (map.size === 0) return map;
      const next = new Map(map);
      for (const entry of next.values()) entry.xp += xp;
      return next;
    });
  }

  private load() {
    try {
      const raw = this.storage.get(STORAGE_KEY);
      if (!raw) return;
      const s: SaveState = JSON.parse(raw);
      this.hasSave = true;
      this.coins.set(s.coins ?? 0);
      this.collection.set(new Map((s.collection ?? []).map((p) => [p.name, p])));
      this.squad.set(s.squad ?? []);
      this.wins.set(s.wins ?? 0);
      this.tier.set(Math.min(s.tier ?? 0, TIERS.length - 1));
      this.visited.set(s.visited ?? []);
      this.inventory.set(s.inventory ?? {});
      this.energy.set(Math.min(s.energy ?? this.config.energyMax, this.config.energyMax));
      this.genFilter.setMaxGen(s.maxGen ?? DEFAULT_GEN);
      this.prestige.set(s.prestige ?? 0);
      this.stats.set(s.stats ?? { ...FRESH_STATS });
      this.savedAt = s.savedAt ?? Date.now();
    } catch {
      this.hasSave = false;
    }
  }

  private persist() {
    this.savedAt = Date.now();
    this.lastSaved.set(this.savedAt);
    try {
      this.storage.set(
        STORAGE_KEY,
        JSON.stringify({
          coins: this.coins(),
          collection: [...this.collection().values()],
          squad: this.squad(),
          wins: this.wins(),
          tier: this.tier(),
          visited: this.visited(),
          inventory: this.inventory(),
          energy: this.energy(),
          maxGen: this.genFilter.maxGen(),
          prestige: this.prestige(),
          stats: this.stats(),
          savedAt: this.savedAt,
        } satisfies SaveState),
      );
    } catch {
      /* storage blocked (private mode) — keep everything in memory */
    }
  }
}
