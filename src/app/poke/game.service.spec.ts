import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { GameService, TIERS, SQUAD_MAX, ENERGY_MAX, CONSUMABLE_ENERGY } from '@poke/game.service';
import { xpForLevel } from '@poke/economy';

describe('GameService', () => {
  it('is created with the three starters', () => {
    TestBed.configureTestingModule({});
    const g = TestBed.inject(GameService);
    expect(['bulbasaur', 'charmander', 'squirtle'].every((n) => g.own(n))).toBe(true);
  });

  it('squad is capped at six', () => {
    TestBed.configureTestingModule({});
    const g = TestBed.inject(GameService);
    const names = Array.from({ length: SQUAD_MAX + 1 }, (_, i) => `p${i}`);
    g.setSquad(names);
    expect(g.squad().length).toBe(SQUAD_MAX);
    g.toggleSquad('overflow');
    expect(g.squad().length).toBe(SQUAD_MAX);
  });

  it('toggleSquad removes when already fielded', () => {
    TestBed.configureTestingModule({});
    const g = TestBed.inject(GameService);
    g.setSquad(['bulbasaur', 'charmander']);
    g.toggleSquad('bulbasaur');
    expect(g.squad()).not.toContain('bulbasaur');
  });

  it('applies idle income every tick', () => {
    TestBed.configureTestingModule({});
    const g = TestBed.inject(GameService);
    const before = g.coins();
    g.tick();
    expect(g.coins()).toBeGreaterThan(before);
  });

  it('rewards a win with coins, xp and a win counter', () => {
    TestBed.configureTestingModule({});
    const g = TestBed.inject(GameService);
    g.setSquad(['charmander']);
    g.add('pikachu', 5);
    g.squad.set(['charmander']);
    const coinsBefore = g.coins();
    const xpBefore = g.own('charmander')!.xp;
    g.award('player');
    expect(g.coins()).toBeGreaterThan(coinsBefore);
    expect(g.wins()).toBe(1);
    expect(g.own('charmander')!.xp).toBeGreaterThan(xpBefore);
  });

  it('banks earned xp without auto-leveling until the player clicks', () => {
    TestBed.configureTestingModule({});
    const g = TestBed.inject(GameService);
    g.add('dratini', 1);
    const levelBefore = g.own('dratini')!.level;
    g.grantXp('dratini', 9999);
    expect(g.own('dratini')!.level).toBe(levelBefore); // still waits
    expect(g.pendingLevels('dratini')).toBeGreaterThan(0);
    g.applyLevelUps('dratini');
    const after = g.own('dratini')!;
    expect(after.level).toBeGreaterThan(levelBefore);
    expect(after.xp).toBeLessThan(xpForLevel(after.level)); // only overflow remains
    expect(g.pendingLevels('dratini')).toBe(0);
  });

  it('granting less than one level-up leaves no ready click', () => {
    TestBed.configureTestingModule({});
    const g = TestBed.inject(GameService);
    g.add('ditto', 2);
    const level = g.own('ditto')!.level;
    g.grantXp('ditto', 1);
    expect(g.own('ditto')!.level).toBe(level);
    expect(g.pendingLevels('ditto')).toBe(0);
  });

  it('passive XP applies to the whole collection each tick', () => {
    TestBed.configureTestingModule({});
    const g = TestBed.inject(GameService);
    const before = g.own('squirtle')!.xp;
    g.tick();
    expect(g.own('squirtle')!.xp).toBeGreaterThan(before);
  });

  it('promotes only after enough wins', () => {
    TestBed.configureTestingModule({});
    const g = TestBed.inject(GameService);
    const tier = g.tier();
    for (let i = 0; i < TIERS[tier].winsToPromote; i++) g.wins.update((w) => w + 1);
    expect(g.canPromote()).toBe(true);
    expect(g.promote()).toBe(true);
    expect(g.tier()).toBe(tier + 1);
  });

  it('starts with a few Pokéballs and no spare consumables', () => {
    TestBed.configureTestingModule({});
    const g = TestBed.inject(GameService);
    expect(g.itemCount('pokeball')).toBe(5);
    expect(g.itemCount('greatball')).toBe(0);
  });

  it('adds, stacks and consumes inventory items', () => {
    TestBed.configureTestingModule({});
    const g = TestBed.inject(GameService);
    g.addItem('potion', 2);
    g.addItem('potion', 1);
    expect(g.itemCount('potion')).toBe(3);
    expect(g.consumeItem('potion', 2)).toBe(true);
    expect(g.itemCount('potion')).toBe(1);
    expect(g.consumeItem('potion', 5)).toBe(false);
  });

  it('spendBestBall uses the best owned ball and empties the bag', () => {
    TestBed.configureTestingModule({});
    const g = TestBed.inject(GameService);
    expect(g.spendBestBall()).toBe(1); // plain Pokéball first seed
    g.addItem('greatball', 1);
    expect(g.spendBestBall()).toBe(1.5);
    expect(g.spendBestBall()).toBe(1); // ultra absent, falls back
    expect(g.itemCount('pokeball')).toBe(3);
    g.inventory.set({});
    expect(g.spendBestBall()).toBe(0);
  });

  it('useConsumable restores energy and consumes the item', () => {
    TestBed.configureTestingModule({});
    const g = TestBed.inject(GameService);
    g.energy.set(10);
    g.addItem('potion', 1);
    expect(g.useConsumable('potion')).toBe(CONSUMABLE_ENERGY['potion']);
    expect(g.energy()).toBe(10 + CONSUMABLE_ENERGY['potion']);
    expect(g.itemCount('potion')).toBe(0);
    expect(g.useConsumable('potion')).toBe(-1); // gone
    expect(g.energy()).toBeLessThanOrEqual(ENERGY_MAX);
    expect(g.energyInt()).toBe(Math.floor(g.energy()));
  });

  it('energy regens every tick but never exceeds the cap', () => {
    TestBed.configureTestingModule({});
    const g = TestBed.inject(GameService);
    g.energy.set(3);
    g.tick();
    expect(g.energy()).toBeGreaterThan(3);
    g.energy.set(ENERGY_MAX);
    g.tick();
    expect(g.energy()).toBe(ENERGY_MAX);
  });

  it('income scales with the collection size', () => {
    TestBed.configureTestingModule({});
    const g = TestBed.inject(GameService);
    const base = g.incomePerSec();
    g.add('rattata', 1);
    g.add('pidgey', 1);
    expect(g.incomePerSec()).toBeGreaterThan(base);
  });

  it('career stats track battles/wins/coins and level-ups', () => {
    TestBed.configureTestingModule({});
    const g = TestBed.inject(GameService);
    const before = g.stats();
    g.award('player');
    g.addLevel('bulbasaur', 2);
    expect(g.stats().wins).toBe(before.wins + 1);
    expect(g.stats().battles).toBe(before.battles + 1);
    expect(g.stats().coinsEarned).toBeGreaterThan(before.coinsEarned);
    expect(g.stats().levelUps).toBe(before.levelUps + 2);
  });

  it('catch counter increments on noteCatch', () => {
    TestBed.configureTestingModule({});
    const g = TestBed.inject(GameService);
    const before = g.stats().catches;
    g.noteCatch();
    expect(g.stats().catches).toBe(before + 1);
  });

  it('prestige requires the top tier and banks a shard', () => {
    TestBed.configureTestingModule({});
    const g = TestBed.inject(GameService);
    expect(g.canPrestige()).toBe(false);
    expect(g.prestigeReset()).toBe(false);
    g.tier.set(4);
    expect(g.canPrestige()).toBe(true);
    expect(g.prestigeReset()).toBe(true);
    expect(g.prestige()).toBe(1);
    expect(g.tier()).toBe(0);
    expect(g.collection().size).toBeGreaterThan(0); // fresh starters
    expect(g.wins()).toBe(0);
  });
});
