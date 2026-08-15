import { describe, expect, it } from 'vitest';
import { POOL_SIZE, rarityFor } from '@poke/features/adventure/adventure';

describe('rarityFor', () => {
  it('bands species by base experience', () => {
    expect(rarityFor(50)).toBe('common'); // pidgey
    expect(rarityFor(72)).toBe('uncommon');
    expect(rarityFor(112)).toBe('rare'); // pikachu
    expect(rarityFor(189)).toBe('epic'); // gyarados
    expect(rarityFor(270)).toBe('legendary'); // dragonite
    expect(rarityFor(306)).toBe('legendary'); // mewtwo
  });

  it('exposes a sensible pool size', () => {
    expect(POOL_SIZE).toBeGreaterThanOrEqual(8);
    expect(POOL_SIZE).toBeLessThanOrEqual(24);
  });
});
