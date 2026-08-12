import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { GameService } from '@poke/game.service';
import { MissionsService } from '@poke/missions.service';

describe('MissionsService', () => {
  it('flags a mission complete once its goal is reached', () => {
    TestBed.configureTestingModule({});
    const missions = TestBed.inject(MissionsService);
    const firstWin = missions.missions().find((m) => m.id.startsWith('first-win'))!;
    expect(missions.isDone(firstWin)).toBe(false);
    TestBed.inject(GameService).award('player');
    expect(missions.isDone(firstWin)).toBe(true);
    expect(missions.canClaim(firstWin)).toBe(true);
  });

  it('claims pay coins exactly once', () => {
    TestBed.configureTestingModule({});
    const game = TestBed.inject(GameService);
    const missions = TestBed.inject(MissionsService);
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
    const game = TestBed.inject(GameService);
    const missions = TestBed.inject(MissionsService);
    const collector = missions.missions().find((m) => m.id.startsWith('collector-6'))!;
    expect(missions.progressOf(collector)).toBe(3); // the starters
    game.add('rattata', 1);
    expect(missions.progressOf(collector)).toBe(4);
  });
});
