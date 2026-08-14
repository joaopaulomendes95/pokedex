import { describe, expect, it } from 'vitest';
import { BASE_CUPS, getCupsForTier } from '@poke/tournament';

describe('tournaments', () => {
  it('gates base cups behind ladder tiers', () => {
    expect(getCupsForTier(0).map((c) => c.id)).toEqual(['rookie']);
    expect(getCupsForTier(1).map((c) => c.id)).toEqual(['rookie', 'silver']);
    expect(getCupsForTier(2).map((c) => c.id)).toEqual(['rookie', 'silver', 'pro']);
    expect(getCupsForTier(3).map((c) => c.id)).toEqual(['rookie', 'silver', 'pro', 'grand']);
    expect(getCupsForTier(4).length).toBeGreaterThan(0);
  });

  it('every base cup escalates difficulty and rewards', () => {
    for (let i = 1; i < BASE_CUPS.length; i++) {
      const prev = BASE_CUPS[i - 1]!;
      const cur = BASE_CUPS[i]!;
      expect(cur.rivalLevel).toBeGreaterThan(prev.rivalLevel);
      expect(cur.finalPrize).toBeGreaterThan(prev.finalPrize);
    }
  });
});
