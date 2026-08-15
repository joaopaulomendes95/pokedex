import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Game } from '@poke/game';
import { Missions } from '@poke/missions';

describe('Missions', () => {
  it('flags a mission complete once its goal is reached', () => {
    TestBed.configureTestingModule({});
    const missions = TestBed.inject(Missions);
    const firstWin = missions.missions().find((m) => m.id.startsWith('first-win'))!;
    expect(missions.isDone(firstWin)).toBe(false);
    TestBed.inject(Game).award('player');
    expect(missions.isDone(firstWin)).toBe(true);
    expect(missions.canClaim(firstWin)).toBe(true);
  });

  it('claims pay coins exactly once', () => {
    TestBed.configureTestingModule({});
    const game = TestBed.inject(Game);
    const missions = TestBed.inject(Missions);
    const firstWin = missions.missions().find((m) => m.id.startsWith('first-win'))!;
    game.award('player');
    const coinsBefore = game.coins();
    expect(missions.claim(firstWin)).toBe(true);
    expect(game.coins()).toBe(coinsBefore + firstWin.reward);
    expect(missions.claim(firstWin)).toBe(false); // second claim is a no-op
    expect(missions.claimed().has(firstWin.id)).toBe(true);
  });

  it('collection missions read the roster size', () => {
    TestBed.configureTestingModule({});
    const game = TestBed.inject(Game);
    const missions = TestBed.inject(Missions);
    const collector = missions.missions().find((m) => m.id.startsWith('collector-6'))!;
    expect(missions.progressOf(collector)).toBe(3); // the starters
    game.add('rattata', 1);
    expect(missions.progressOf(collector)).toBe(4);
  });
});

describe('Missions claim counts', () => {
  it('counts how many times each base mission has been claimed', () => {
    TestBed.configureTestingModule({});
    const game = TestBed.inject(Game);
    const missions = TestBed.inject(Missions);
    // Complete + claim the same base mission twice (across tier resets is
    // simulated by the tier-up reusing the same base id with a new suffix).
    const firstWin = missions.missions().find((m) => m.id.startsWith('first-win'))!;
    game.award('player');
    expect(missions.claim(firstWin)).toBe(true);
    expect(missions.claimCount(firstWin)).toBe(1);
    // The count is keyed by the BASE id, not the tiered instance id.
    expect(missions.counts()['first-win']).toBe(1);
  });
});

describe('Missions readyCount', () => {
  it('counts claimable missions and drops after claiming', () => {
    TestBed.configureTestingModule({});
    const game = TestBed.inject(Game);
    const missions = TestBed.inject(Missions);
    const before = missions.readyCount();
    game.award('player'); // completes first-win
    expect(missions.readyCount()).toBeGreaterThanOrEqual(before + 1);
    const firstWin = missions.missions().find((m) => m.id.startsWith('first-win'))!;
    missions.claim(firstWin);
    expect(missions.readyCount()).toBe(before);
  });
});

describe('Missions soft-lock guard', () => {
  it('claiming every mission of a tier advances it (no soft-lock)', () => {
    TestBed.configureTestingModule({});
    const game = TestBed.inject(Game);
    const missions = TestBed.inject(Missions);
    // Pump every career stat past the tier-0 goals: wins + promotions to the
    // Champion tier, coins, level-ups on an OWNED monster, catches, collection.
    for (const target of [3, 3, 4, 4]) {
      for (let i = 0; i < target; i++) game.award('player');
      game.promote();
    }
    game.grantCoins(1000);
    game.addLevel('bulbasaur', 20);
    for (let i = 0; i < 5; i++) game.noteCatch();
    for (const n of ['rattata', 'spearow', 'ekans', 'pidgey', 'jigglypuff']) game.add(n, 1);
    // Every tier-0 mission must now be claimable; claiming them all must
    // advance the tier so the next batch appears.
    const notReady = missions
      .missions()
      .filter((m) => !missions.canClaim(m))
      .map((m) => `${m.id}(${m.stat}:${missions.progressOf(m)}/${m.goal})`);
    const ready = missions.missions().filter((m) => missions.canClaim(m));
    expect(ready.length, notReady.join(' | ')).toBe(missions.missions().length);
    for (const m of ready) expect(missions.claim(m)).toBe(true);
    expect(missions.missionTier()).toBeGreaterThanOrEqual(1);
    expect(missions.missions().some((m) => !missions.claimed().has(m.id))).toBe(true);
  });

  it('resetAll wipes claimed set, counts and tier', () => {
    TestBed.configureTestingModule({});
    const game = TestBed.inject(Game);
    const missions = TestBed.inject(Missions);
    game.award('player');
    const firstWin = missions.missions().find((m) => m.id.startsWith('first-win'))!;
    missions.claim(firstWin);
    expect(missions.claimed().size).toBeGreaterThan(0);
    expect(missions.missionTier()).toBeGreaterThanOrEqual(0);
    missions.resetAll();
    expect(missions.claimed().size).toBe(0);
    expect(missions.missionTier()).toBe(0);
    expect(Object.keys(missions.counts()).length).toBe(0);
  });
});
