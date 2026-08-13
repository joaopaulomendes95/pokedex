import { inject, Service } from '@angular/core';
import { Notifier } from '@core/services/notifications/notification';

/**
 * Thin game-facing facade over the overlay Notifier so every
 * screen keeps its `show` / `showError` / `showSuccess` calls.
 */
@Service()
export class Notify {
  #notifier = inject(Notifier);

  show(message: string) {
    this.#notifier.info(message);
  }

  showError(message: string) {
    this.#notifier.error(message);
  }

  showSuccess(message: string) {
    this.#notifier.success(message);
  }
}
