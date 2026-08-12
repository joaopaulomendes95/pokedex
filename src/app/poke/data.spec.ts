import { describe, expect, it } from 'vitest';
import { typeMultiplier } from '@poke/type-chart';
import { parseDetail } from '@poke/poke-data.service';
import { trainCost, xpForLevel } from '@poke/economy';

describe('typeMultiplier', () => {
  it('fire > grass', () => {
    expect(typeMultiplier('fire', ['grass'])).toBe(2);
  });

  it('water < fire', () => {
    expect(typeMultiplier('water', ['fire'])).toBe(2);
  });

  it('normal x ghost is 0', () => {
    expect(typeMultiplier('normal', ['ghost'])).toBe(0);
  });

  it('dual types multiply (ghost x normal = 0, no entry for flying → 1)', () => {
    expect(typeMultiplier('ghost', ['normal', 'flying'])).toBe(0);
  });
});

describe('parseDetail', () => {
  it('maps a PokeAPI body into our detail shape', () => {
    const d = parseDetail({
      id: 25,
      name: 'pikachu',
      types: [{ type: { name: 'electric' } }],
      stats: [
        { stat: { name: 'hp' }, base_stat: 35 },
        { stat: { name: 'attack' }, base_stat: 55 },
        { stat: { name: 'defense' }, base_stat: 40 },
        { stat: { name: 'special-attack' }, base_stat: 50 },
        { stat: { name: 'special-defense' }, base_stat: 50 },
        { stat: { name: 'speed' }, base_stat: 90 },
      ],
      sprites: {
        front_default: 'front.png',
        other: { 'official-artwork': { front_default: 'art.png' } },
      },
    });
    expect(d).toMatchObject({
      id: 25,
      name: 'pikachu',
      types: ['electric'],
      spriteUrl: 'front.png',
      artworkUrl: 'art.png',
    });
    expect(d.stats).toMatchObject({ hp: 35, attack: 55, speed: 90 });
  });

  it('survives missing fields', () => {
    const d = parseDetail({});
    expect(d.types).toEqual([]);
    expect(d.stats.hp).toBe(0);
    expect(d.spriteUrl).toBe('');
  });
});

describe('market economy', () => {
  it('training costs increase with level', () => {
    expect(trainCost(1)).toBe(30);
    expect(trainCost(2)).toBeGreaterThan(trainCost(1));
    expect(trainCost(5)).toBeGreaterThan(trainCost(3));
  });

  it('xp requirements grow per level', () => {
    expect(xpForLevel(1)).toBe(30);
    expect(xpForLevel(3)).toBeGreaterThan(xpForLevel(1));
  });
});
