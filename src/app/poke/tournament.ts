export interface Cup {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  /** Coins charged to enter. */
  entryFee: number;
  /** Battles the player must win in a row to lift the cup. */
  battles: number;
  /** Base level of the rival team for this cup. */
  rivalLevel: number;
  /** How many creatures the rival fields. */
  rivalTeamSize: number;
  /** Coin reward per won battle (on top of the normal win payout). */
  prizePerBattle: number;
  /** Bonus for winning the whole cup. */
  finalPrize: number;
  /** Lowest ladder tier that can enter this cup. */
  minTier: number;
  /** Series number for infinite cups (0 = base cups). */
  series?: number;
  /** Optional rule modifiers — challenge cups play by different rules. */
  rules?: CupRule[];
}

/** One rule modifier for a challenge cup. */
export interface CupRule {
  id: 'squadSize' | 'levelCap' | 'genOnly';
  /** squadSize = max fielded fighters; levelCap = max fighter level; genOnly = max generation. */
  value: number;
}

/** Human label for a cup rule chip. */
export function ruleLabel(r: CupRule): string {
  switch (r.id) {
    case 'squadSize':
      return `👥 ${r.value} max`;
    case 'levelCap':
      return `🎚 Lv ≤ ${r.value}`;
    case 'genOnly':
      return `📜 Gen ${r.value} only`;
  }
}

/** Squad energy drained per cup battle. */
export const CUP_BATTLE_ENERGY = 15;

/** Squad energy drained per quick-fight battle. */
export const QUICK_BATTLE_ENERGY = 10;

/** Base cups, unlocked as the ladder tier rises. */
export const BASE_CUPS: Cup[] = [
  {
    id: 'rookie',
    name: 'Rookie Cup',
    tagline: 'A gentle warm-up for freshly-trained trainers.',
    icon: 'sports_esports',
    entryFee: 40,
    battles: 3,
    rivalLevel: 4,
    rivalTeamSize: 2,
    prizePerBattle: 15,
    finalPrize: 90,
    minTier: 0,
  },
  {
    id: 'silver',
    name: 'Silver Cup',
    tagline: 'Steady hands and a levelled roster.',
    icon: 'workspace_premium',
    entryFee: 100,
    battles: 4,
    rivalLevel: 6,
    rivalTeamSize: 3,
    prizePerBattle: 35,
    finalPrize: 170,
    minTier: 1,
  },
  {
    id: 'mini',
    name: 'Mini Cup',
    tagline: 'Small squads only — bring your best three.',
    icon: 'groups',
    entryFee: 60,
    battles: 3,
    rivalLevel: 7,
    rivalTeamSize: 3,
    prizePerBattle: 40,
    finalPrize: 200,
    minTier: 1,
    rules: [
      { id: 'squadSize', value: 3 },
      { id: 'levelCap', value: 40 },
    ],
  },
  {
    id: 'retro',
    name: 'Retro Cup',
    tagline: 'Original 151 only — nostalgia battles.',
    icon: 'history_edu',
    entryFee: 150,
    battles: 4,
    rivalLevel: 8,
    rivalTeamSize: 3,
    prizePerBattle: 50,
    finalPrize: 240,
    minTier: 2,
    rules: [{ id: 'genOnly', value: 1 }],
  },
  {
    id: 'pro',
    name: 'Pro League Cup',
    tagline: 'Proper opponents. Keep your cool and your roster.',
    icon: 'emoji_events',
    entryFee: 180,
    battles: 4,
    rivalLevel: 9,
    rivalTeamSize: 3,
    prizePerBattle: 55,
    finalPrize: 260,
    minTier: 2,
  },
  {
    id: 'grand',
    name: 'Grand Cup',
    tagline: 'Near the top of the ladder — no room for mistakes.',
    icon: 'shield',
    entryFee: 300,
    battles: 5,
    rivalLevel: 11,
    rivalTeamSize: 4,
    prizePerBattle: 95,
    finalPrize: 480,
    minTier: 3,
  },
  {
    id: 'veteran',
    name: 'Veteran Cup',
    tagline: 'Experienced squads, capped levels — skill over raw power.',
    icon: 'military_tech',
    entryFee: 250,
    battles: 4,
    rivalLevel: 12,
    rivalTeamSize: 4,
    prizePerBattle: 100,
    finalPrize: 520,
    minTier: 3,
    rules: [{ id: 'levelCap', value: 30 }],
  },
  {
    id: 'champion',
    name: 'Champion Super Cup',
    tagline: 'The top of the ladder. Win all five to be crowned.',
    icon: 'military_tech',
    entryFee: 420,
    battles: 5,
    rivalLevel: 14,
    rivalTeamSize: 3,
    prizePerBattle: 140,
    finalPrize: 760,
    minTier: 4,
  },
];

/**
 * Generate the current Elite Series cups for a 0-based elite rank.
 * Rank 0 → "Elite Series 1", rank 1 → "Elite Series 2", … each rank
 * scales difficulty, entry fee and prizes, so the cups are truly endless
 * and every series win ranks you up into the next one.
 */
export function getEliteCups(rank: number): Cup[] {
  const cups: Cup[] = [];
  const series = Math.max(0, rank);
  const baseRivalLevel = 15 + series * 3;
  const baseEntryFee = 600 + series * 200;
  const basePrizePerBattle = 200 + series * 50;
  const baseFinalPrize = 1000 + series * 300;

  for (let i = 0; i < 3; i++) {
    const difficultyMultiplier = 1 + i * 0.25 + series * 0.15;
    cups.push({
      id: `elite-${series}-${i}`,
      name: `Elite Series ${series + 1}-${i + 1}`,
      tagline: `Elite challengers await. Series ${series + 1}, Division ${i + 1}.`,
      icon: 'military_tech',
      entryFee: Math.round(baseEntryFee * (1 + i * 0.3)),
      battles: 5 + i,
      rivalLevel: Math.round(baseRivalLevel * difficultyMultiplier),
      rivalTeamSize: 3,
      prizePerBattle: Math.round(basePrizePerBattle * difficultyMultiplier),
      finalPrize: Math.round(baseFinalPrize * difficultyMultiplier),
      minTier: 4,
      series,
    });
  }
  return cups;
}

/** Generate infinite cups for a given tier (post-Champion Cup). */
export function generateInfiniteCups(tier: number): Cup[] {
  return getEliteCups(tier - 4);
}

/** Get all available cups for a given tier. */
export function getCupsForTier(tier: number): Cup[] {
  if (tier < 4) {
    return BASE_CUPS.filter((c) => c.minTier <= tier);
  }
  return generateInfiniteCups(tier);
}

export const CUPS = BASE_CUPS; // Backward compatibility
