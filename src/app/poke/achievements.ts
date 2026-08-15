import { computed, effect, inject, signal, Service } from '@angular/core';
import { Game } from '@poke/game';
import { EliteSeries } from '@poke/elite-series';
import { BrowserStorage } from '@core/services/storage';
import { Notify } from '@poke/notify';

const ACH_KEY = 'poke-league-achievements';

/** One permanent, one-time achievement. */
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** Coins granted the moment the goal is met (auto-reward, no claim step). */
  reward: number;
  test: (game: Game, elite: EliteSeries) => boolean;
}

/** How many shinies the collection holds (feeds the shiny achievements). */
function shinyCount(game: Game): number {
  let n = 0;
  for (const owned of game.collection().values()) if (owned.shiny) n++;
  return n;
}

/** Permanent one-time goals — the "wow, I did that" layer of the idle loop. */
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-win',
    title: 'First Blood',
    description: 'Win your first battle.',
    icon: 'sports_martial_arts',
    reward: 50,
    test: (g) => g.stats().wins >= 1,
  },
  {
    id: 'win-25',
    title: 'Battle-hardened',
    description: 'Win 25 battles.',
    icon: 'shield',
    reward: 300,
    test: (g) => g.stats().wins >= 25,
  },
  {
    id: 'win-100',
    title: 'Undisputed',
    description: 'Win 100 battles.',
    icon: 'military_tech',
    reward: 1500,
    test: (g) => g.stats().wins >= 100,
  },
  {
    id: 'catcher-10',
    title: 'Catch em all… for now',
    description: 'Catch 10 wild Pokémon.',
    icon: 'pets',
    reward: 200,
    test: (g) => g.stats().catches >= 10,
  },
  {
    id: 'collector-30',
    title: 'Growing menagerie',
    description: 'Own 30 different species.',
    icon: 'catching_pokemon',
    reward: 500,
    test: (g) => g.collection().size >= 30,
  },
  {
    id: 'collector-100',
    title: 'Living dex',
    description: 'Own 100 different species.',
    icon: 'menu_book',
    reward: 2500,
    test: (g) => g.collection().size >= 100,
  },
  {
    id: 'leveler-50',
    title: 'Level Grinder',
    description: 'Level up 50 times (any source).',
    icon: 'trending_up',
    reward: 400,
    test: (g) => g.stats().levelUps >= 50,
  },
  {
    id: 'evolve-1',
    title: 'Metamorphosis',
    description: 'Evolve your first Pokémon.',
    icon: 'auto_awesome',
    reward: 150,
    test: (g) => g.stats().evolves >= 1,
  },
  {
    id: 'evolve-10',
    title: 'Chain smith',
    description: 'Evolve 10 Pokémon.',
    icon: 'layers',
    reward: 800,
    test: (g) => g.stats().evolves >= 10,
  },
  {
    id: 'shiny-1',
    title: '✨ Lucky break',
    description: 'Hold a shiny Pokémon.',
    icon: 'star',
    reward: 500,
    test: (g) => shinyCount(g) >= 1,
  },
  {
    id: 'prestige-1',
    title: 'New game plus',
    description: 'Prestige once (bank a shard).',
    icon: 'restart_alt',
    reward: 1000,
    test: (g) => g.prestige() >= 1,
  },
  {
    id: 'prestige-5',
    title: 'Phoenix',
    description: 'Prestige 5 times.',
    icon: 'local_fire_department',
    reward: 5000,
    test: (g) => g.prestige() >= 5,
  },
  {
    id: 'champion',
    title: 'Champion trainer',
    description: 'Reach the Champion Cup tier.',
    icon: 'emoji_events',
    reward: 800,
    test: (g) => g.tier() >= 4,
  },
  {
    id: 'elite-1',
    title: 'Beyond the ladder',
    description: 'Win your first Elite Series cup.',
    icon: 'workspace_premium',
    reward: 1200,
    test: (_g, elite) => elite.cupsWon() >= 1,
  },
  {
    id: 'rich-10k',
    title: 'Coin hoarder',
    description: 'Earn 10,000 coins in total.',
    icon: 'monetization_on',
    reward: 750,
    test: (g) => g.stats().coinsEarned >= 10_000,
  },
];

/**
 * Permanent one-time achievements: auto-rewarded (coins + toast) the moment
 * their goal is met, persisted so each pays exactly once across prestiges.
 */
@Service()
export class Achievements {
  #_unlocked = signal<Set<string>>(new Set());
  readonly unlocked = this.#_unlocked.asReadonly();

  /** How many achievements are still to earn (for progress display). */
  readonly earnedCount = computed(() => this.#_unlocked().size);

  readonly unlockedCount = computed(
    () => ACHIEVEMENTS.filter((a) => this.#_unlocked().has(a.id)).length,
  );

  isUnlocked(a: Achievement): boolean {
    return this.#_unlocked().has(a.id);
  }

  isDone(a: Achievement): boolean {
    return a.test(this.#game, this.#elite);
  }

  #game = inject(Game);
  #elite = inject(EliteSeries);
  #storage = inject(BrowserStorage);
  #notify = inject(Notify);

  /** Already-announced ids (so an unlock only toasts once per session). */
  #seen = new Set<string>();

  constructor() {
    this.load();
    // Seed the seen-set so a fresh boot doesn't re-announce old unlocks.
    this.#seen = new Set(this.#_unlocked());

    // Watch the game signals; the moment a goal flips, pay out + toast.
    effect(() => {
      void this.#game.stats();
      void this.#game.tier();
      void this.#game.collection();
      void this.#game.prestige();
      void this.#elite.cupsWon();
      for (const a of ACHIEVEMENTS) {
        if (this.#_unlocked().has(a.id)) continue;
        if (a.test(this.#game, this.#elite)) {
          this.#_unlocked.update((s) => new Set(s).add(a.id));
          this.#game.grantCoins(a.reward);
          this.persist();
          if (!this.#seen.has(a.id)) {
            this.#seen.add(a.id);
            this.#notify.show(`🏅 Achievement: ${a.title} (+${a.reward}¢)`);
          }
        }
      }
    });
  }

  private load() {
    try {
      const raw = this.#storage.get(ACH_KEY);
      if (!raw) return;
      this.#_unlocked.set(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* corrupted save — start fresh */
    }
  }

  private persist() {
    try {
      this.#storage.set(ACH_KEY, JSON.stringify([...this.#_unlocked()]));
    } catch {
      /* storage blocked — keep in memory */
    }
  }
}
