import { signal, Service } from '@angular/core';
import { Cup } from '@poke/tournament';

export interface CupRun {
  cup: Cup;
  wins: boolean[];
  status: 'active' | 'won' | 'lost';
}

/**
 * Holds the active tournament run at the root injector so it survives tab
 * switches (poke-hub destroys the Arena component via @switch, which used to
 * wipe cup progress whenever the player left to the Market and came back).
 */
@Service()
export class CupRuns {
  readonly run = signal<CupRun | null>(null);
}
