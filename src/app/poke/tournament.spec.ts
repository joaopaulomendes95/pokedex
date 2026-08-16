import { describe, expect, it } from 'vitest';
import { BASE_CUPS, getCupsForTier, getEliteCups, ruleLabel } from '@poke/tournament';

describe('tournaments', () => {
  it('gates base cups behind ladder tiers (rule cups included)', () => {
    expect(getCupsForTier(0).map((c) => c.id)).toEqual(['rookie']);
    expect(getCupsForTier(1).map((c) => c.id)).toEqual(['rookie', 'silver', 'mini']);
    expect(getCupsForTier(2).map((c) => c.id)).toEqual([
      'rookie',
      'silver',
      'mini',
      'retro',
      'pro',
    ]);
    expect(getCupsForTier(3).map((c) => c.id)).toEqual([
      'rookie',
      'silver',
      'mini',
      'retro',
      'pro',
      'grand',
      'veteran',
    ]);
    expect(getCupsForTier(4).length).toBeGreaterThan(0);
  });

  it('challenge cups carry enforceable rules', () => {
    const mini = BASE_CUPS.find((c) => c.id === 'mini')!;
    const retro = BASE_CUPS.find((c) => c.id === 'retro')!;
    const veteran = BASE_CUPS.find((c) => c.id === 'veteran')!;
    expect(mini.rules).toEqual([
      { id: 'squadSize', value: 3 },
      { id: 'levelCap', value: 40 },
    ]);
    expect(retro.rules).toEqual([{ id: 'genOnly', value: 1 }]);
    expect(veteran.rules).toEqual([{ id: 'levelCap', value: 30 }]);
    expect(ruleLabel(mini.rules![0]!)).toMatch(/3/);
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

describe('elite series cups', () => {
  it('scales difficulty and prizes with rank', () => {
    const rank0 = getEliteCups(0);
    const rank2 = getEliteCups(2);
    expect(rank0.length).toBe(3);
    expect(rank2.length).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(rank2[i]!.rivalLevel).toBeGreaterThan(rank0[i]!.rivalLevel);
      expect(rank2[i]!.entryFee).toBeGreaterThan(rank0[i]!.entryFee);
      expect(rank2[i]!.finalPrize).toBeGreaterThan(rank0[i]!.finalPrize);
      expect(rank2[i]!.series).toBe(2);
    }
  });

  it('elite cups are gated behind the Champion tier and rank up per win', () => {
    const champion = getCupsForTier(4);
    expect(champion.every((c) => c.series !== undefined)).toBe(true);
    // Winning a cup moves to the next series (rank + 1).
    const next = getEliteCups(champion[0]!.series! + 1);
    expect(next[0]!.series).toBe(champion[0]!.series! + 1);
  });
});
