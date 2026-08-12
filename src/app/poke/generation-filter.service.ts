import { computed, signal, Service } from '@angular/core';

/** Service global para o filtro de geração (1–9). */
@Service()
export class GenerationFilterService {
  private readonly _maxGen = signal(2); // default: Gen 2

  /** Geração máxima permitida (1–9). */
  readonly maxGen = this._maxGen.asReadonly();

  /** Define a geração máxima (clamped 1–9). */
  setMaxGen(gen: number) {
    this._maxGen.set(Math.max(1, Math.min(9, gen)));
  }

  /** Aumenta uma geração (até 9). */
  increment() {
    this._maxGen.update((g) => Math.min(9, g + 1));
  }

  /** Diminui uma geração (mínimo 1). */
  decrement() {
    this._maxGen.update((g) => Math.max(1, g - 1));
  }

  /** Se a Gen 1 está activa (modo "Kanto only"). */
  readonly isGen1Only = computed(() => this._maxGen() === 1);
}
