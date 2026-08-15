import { computed, effect, inject, signal, Service } from '@angular/core';
import { Game } from '@poke/game';
import { BrowserStorage } from '@core/services/storage';
import { Notify } from '@poke/notify';
import { UiState, TAB_QUESTS } from '@poke/ui-state';

export interface Mission {
  id: string;
  title: string;
  description: string;
  icon: string;
  goal: number;
  /** Coins rewarded on claim. */
  reward: number;
  /** Career stat the mission tracks. */
  stat: 'battles' | 'wins' | 'catches' | 'coinsEarned' | 'levelUps' | 'collection' | 'tier';
  /** Mission tier (0 = base, 1+ = incremental). */
  tier?: number;
}

/** Base mission definitions (tier 0). */
const BASE_MISSIONS: Omit<Mission, 'tier'>[] = [
  {
    id: 'first-win',
    title: 'First Blood',
    description: 'Win a single battle.',
    icon: 'sports_martial_arts',
    goal: 1,
    reward: 25,
    stat: 'wins',
  },
  {
    id: 'grind-10',
    title: 'Getting Comfortable',
    description: 'Battle 10 times.',
    icon: 'local_fire_department',
    goal: 10,
    reward: 120,
    stat: 'battles',
  },
  {
    id: 'win-5',
    title: 'Five in a Row Mindset',
    description: 'Win 5 battles.',
    icon: 'shield',
    goal: 5,
    reward: 150,
    stat: 'wins',
  },
  {
    id: 'collector-6',
    title: 'Mini Collector',
    description: 'Own 6 creatures.',
    icon: 'catching_pokemon',
    goal: 6,
    reward: 200,
    stat: 'collection',
  },
  {
    id: 'hunter-3',
    title: 'Trainer Hunter',
    description: 'Catch 3 wild Pokémon.',
    icon: 'pets',
    goal: 3,
    reward: 160,
    stat: 'catches',
  },
  {
    id: 'xp-10',
    title: 'Level Grinder',
    description: 'Level up 10 times.',
    icon: 'trending_up',
    goal: 10,
    reward: 180,
    stat: 'levelUps',
  },
  {
    id: 'remittance',
    title: 'Coins Collector',
    description: 'Earn 400 coins in total.',
    icon: 'monetization_on',
    goal: 400,
    reward: 90,
    stat: 'coinsEarned',
  },
  {
    id: 'pro-league',
    title: 'Into the League',
    description: 'Reach the Pro League tier.',
    icon: 'emoji_events',
    goal: 2,
    reward: 400,
    stat: 'tier',
  },
  {
    id: 'champion',
    title: 'Champion Aspirant',
    description: 'Reach the Champion Cup tier.',
    icon: 'military_tech',
    goal: 4,
    reward: 1000,
    stat: 'tier',
  },
];

const MISSION_KEY = 'poke-league-missions';

/** The localStorage key mission progress lives under (for save import/export). */
export const MISSIONS_KEY = MISSION_KEY;

/**
 * Mission ids look like "first-win-t3" — the base id is the part before the
 * `-tN` tier suffix. Claim counts are tracked per base mission across tiers.
 */
export function baseMissionId(id: string): string {
  const idx = id.lastIndexOf('-t');
  return idx > 0 ? id.slice(0, idx) : id;
}

interface MissionsSave {
  claimed: string[];
  tier: number;
  /** base mission id → how many times it has been claimed (across tiers). */
  counts: Record<string, number>;
}

/**
 * Mission/quest catalog with claimable rewards. Progress reads the lifetime
 * career stats from `Game`; a claimed-set persists to localStorage so
 * each mission pays out exactly once.
 *
 * Supports infinite tiers: each tier multiplies goals and rewards.
 * Tier 0 = base missions, Tier 1 = 2x goals/2x rewards, Tier 2 = 4x/4x, etc.
 */
@Service()
export class Missions {
  /** Set of mission ids already claimed (read-only for the UI). */
  readonly claimed = computed(() => new Set<string>(this.#_claimed()));
  #_claimed = signal<Set<string>>(new Set());

  /** base mission id → number of times it has been claimed across tiers. */
  #_counts = signal<Record<string, number>>({});
  readonly counts = this.#_counts.asReadonly();

  /** How many times the given mission's base type has been claimed. */
  claimCount(mission: Mission): number {
    return this.#_counts()[baseMissionId(mission.id)] ?? 0;
  }

  /** Current mission tier (increments when all missions in current tier are claimed). */
  #_missionTier = signal(0);
  readonly missionTier = this.#_missionTier.asReadonly();

  /** All missions for the current tier (generated dynamically). */
  readonly missions = computed<Mission[]>(() => {
    const tier = this.missionTier();
    return BASE_MISSIONS.map((base) => ({
      ...base,
      id: `${base.id}-t${tier}`,
      goal: Math.round(base.goal * Math.pow(2, tier)),
      reward: Math.round(base.reward * Math.pow(2, tier)),
      tier,
    }));
  });

  /** Total missions across all tiers (for progress display). */
  readonly totalMissionsAllTiers = computed(() => {
    return BASE_MISSIONS.length * (this.missionTier() + 1);
  });
  /** Completed missions in current tier. */
  readonly completedInTier = computed(() => {
    return this.missions().filter((m) => this.isDone(m)).length;
  });

  /** Whether all missions in current tier are claimed (ready for next tier). */
  readonly tierComplete = computed(() => {
    return this.missions().every((m) => this.#_claimed().has(m.id));
  });

  /** Raw progress value for a mission (reads the matching career counter). */
  progressOf(mission: Mission): number {
    switch (mission.stat) {
      case 'collection':
        return this.#game.collection().size;
      case 'tier':
        return this.#game.tier();
      default:
        return this.#game.stats()[mission.stat] ?? 0;
    }
  }

  /** Mission completion derived purely from `progressOf`. */
  isDone(mission: Mission): boolean {
    return this.progressOf(mission) >= mission.goal;
  }

  /** Residual progress (0..1) as a fraction of the goal — gauge fill. */
  progressPct(mission: Mission): number {
    return Math.min(1, this.progressOf(mission) / mission.goal);
  }

  /** Whether a mission is complete AND still unclaimed (ready to pay out). */
  canClaim(mission: Mission): boolean {
    return !this.#_claimed().has(mission.id) && this.isDone(mission);
  }

  /** How many missions are ready to claim right now (navbar badge + toasts). */
  readonly readyCount = computed(() => this.missions().filter((m) => this.canClaim(m)).length);

  /** Claims a completed mission: pays coins + drops it into the claimed set. */
  claim(mission: Mission): boolean {
    if (!this.canClaim(mission)) return false;
    this.#game.grantCoins(mission.reward);
    this.#_claimed.update((s) => new Set(s).add(mission.id));
    const base = baseMissionId(mission.id);
    this.#_counts.update((c) => ({ ...c, [base]: (c[base] ?? 0) + 1 }));
    // Advance the tier BEFORE persisting — otherwise a save written right
    // after the last claim of a tier could lock the missions forever.
    if (this.tierComplete()) {
      this.#_missionTier.update((t) => t + 1);
    }
    this.persist();
    return true;
  }

  /**
   * Wipe ALL mission progress: claimed set, claim counts and tier (back to 0).
   * Career stats (battles/wins/catches…) are kept, so the next tier-0 missions
   * may already be complete and claimable.
   */
  resetAll(): void {
    this.#_claimed.set(new Set());
    this.#_counts.set({});
    this.#_missionTier.set(0);
    this.#seenReady = new Set(
      this.missions()
        .filter((m) => this.canClaim(m))
        .map((m) => m.id),
    );
    this.#seenTier = 0;
    this.persist();
  }

  /** Persist the current mission state immediately (used by save export). */
  flush(): void {
    this.persist();
  }

  #game = inject(Game);
  #storage = inject(BrowserStorage);
  #notify = inject(Notify);
  #ui = inject(UiState);

  /** Claimable mission ids already seen (so a completion only toasts once). */
  #seenReady = new Set<string>();
  /** Mission tier already announced (so tier-ups toast once, not at boot). */
  #seenTier = -1;

  constructor() {
    this.load();
    effect(() => void this.#game.stats()); // reactive anchor for derived UI
    // Seed the seen-sets so a fresh boot doesn't toast missions that were
    // already claimable before this session.
    this.#seenReady = new Set(
      this.missions()
        .filter((m) => this.canClaim(m))
        .map((m) => m.id),
    );
    this.#seenTier = this.missionTier();

    // Mission finished while the player is elsewhere → toast + navbar badge.
    effect(() => {
      const ready = new Set(
        this.missions()
          .filter((m) => this.canClaim(m))
          .map((m) => m.id),
      );
      const fresh = [...ready].filter((id) => !this.#seenReady.has(id));
      this.#seenReady = ready;
      if (fresh.length === 0) return;
      // Already looking at the missions — no need to announce them.
      if (this.#ui.tab() === TAB_QUESTS) return;
      const titles = this.missions()
        .filter((m) => fresh.includes(m.id))
        .map((m) => m.title);
      const msg =
        titles.length === 1
          ? `🏁 Mission ready: ${titles[0]} — claim it in the Idle tab!`
          : `🏁 ${titles.length} missions ready: ${titles.join(', ')} — claim them in the Idle tab!`;
      this.#notify.show(msg);
    });

    // A whole tier cleared → next tier's missions appear, announce the unlock.
    effect(() => {
      const tier = this.missionTier();
      if (tier > this.#seenTier) {
        this.#seenTier = tier;
        this.#notify.show(
          `🏆 Mission tier ${tier} unlocked — new missions, doubled goals and rewards!`,
        );
      }
    });
  }

  private load() {
    try {
      const raw = this.#storage.get(MISSION_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.claimed) {
        this.#_claimed.set(new Set(data.claimed));
        this.#_missionTier.set(data.tier ?? 0);
        this.#_counts.set(data.counts ?? {});
        // Soft-lock guard: a save that ended with a fully-claimed tier (the
        // old persist-before-bump bug) would block every future claim — skip
        // straight past any tier that is already entirely claimed.
        let guard = 0;
        while (this.tierComplete() && guard++ < 100) {
          this.#_missionTier.update((t) => t + 1);
        }
      } else {
        // Old format
        this.#_claimed.set(new Set(data as string[]));
      }
    } catch {
      /* corrupted save — start a fresh claimed-set */
    }
  }

  private persist() {
    try {
      this.#storage.set(
        MISSION_KEY,
        JSON.stringify({
          claimed: [...this.#_claimed()],
          tier: this.#_missionTier(),
          counts: this.#_counts(),
        } satisfies MissionsSave),
      );
    } catch {
      /* storage blocked — keep in memory */
    }
  }
}
