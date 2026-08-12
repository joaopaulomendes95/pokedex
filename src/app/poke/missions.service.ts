import { computed, effect, inject, signal, Service } from '@angular/core';
import { GameService } from '@poke/game.service';
import { StorageService } from '@core/services/storage.service';

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

/**
 * Mission/quest catalog with claimable rewards. Progress reads the lifetime
 * career stats from `GameService`; a claimed-set persists to localStorage so
 * each mission pays out exactly once.
 * 
 * Supports infinite tiers: each tier multiplies goals and rewards.
 * Tier 0 = base missions, Tier 1 = 2x goals/2x rewards, Tier 2 = 4x/4x, etc.
 */
@Service()
export class MissionsService {
  /** Set of mission ids already claimed (read-only for the UI). */
  readonly claimed = computed(() => new Set<string>(this._claimed()));
  private readonly _claimed = signal<Set<string>>(new Set());

  /** Current mission tier (increments when all missions in current tier are claimed). */
  readonly missionTier = signal(0);

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
    return this.missions().every((m) => this._claimed().has(m.id));
  });

  /** Raw progress value for a mission (reads the matching career counter). */
  progressOf(mission: Mission): number {
    switch (mission.stat) {
      case 'collection':
        return this.game.collection().size;
      case 'tier':
        return this.game.tier();
      default:
        return this.game.stats()[mission.stat] ?? 0;
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
    return !this._claimed().has(mission.id) && this.isDone(mission);
  }

  /** Claims a completed mission: pays coins + drops it into the claimed set. */
  claim(mission: Mission): boolean {
    if (!this.canClaim(mission)) return false;
    this.game.grantCoins(mission.reward);
    this._claimed.update((s) => new Set(s).add(mission.id));
    this.persist();
    // Check if tier is complete
    if (this.tierComplete()) {
      this.missionTier.update((t) => t + 1);
    }
    return true;
  }

  private readonly game = inject(GameService);
  private readonly storage = inject(StorageService);

  constructor() {
    this.load();
    effect(() => void this.game.stats()); // reactive anchor for derived UI
  }

  private load() {
    try {
      const raw = this.storage.get(MISSION_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.claimed) {
        this._claimed.set(new Set(data.claimed));
        this.missionTier.set(data.tier ?? 0);
      } else {
        // Old format
        this._claimed.set(new Set(data as string[]));
      }
    } catch {
      /* corrupted save — start a fresh claimed-set */
    }
  }

  private persist() {
    try {
      this.storage.set(
        MISSION_KEY,
        JSON.stringify({
          claimed: [...this._claimed()],
          tier: this.missionTier(),
        }),
      );
    } catch {
      /* storage blocked — keep in memory */
    }
  }
}