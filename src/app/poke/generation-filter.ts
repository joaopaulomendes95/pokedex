import { signal, Service } from '@angular/core';

/** Service global para o filtro de geração (1–9). */
@Service()
export class GenerationFilter {
  #_maxGen = signal(2); // default: Gen 2

  /** Geração máxima permitida (1–9). */
  readonly maxGen = this.#_maxGen.asReadonly();

  /** Define a geração máxima (clamped 1–9). */
  setMaxGen(gen: number) {
    this.#_maxGen.set(Math.max(1, Math.min(9, gen)));
  }
}
