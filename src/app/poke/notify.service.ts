import { inject, Service } from '@angular/core';
import { NotificationService } from '@core/services/notifications/notification.service';

/**
 * Thin game-facing facade over the APP/ overlay NotificationService so every
 * screen keeps its `show` / `showError` / `showSuccess` calls.
 */
@Service()
export class NotifyService {
  private readonly notifier = inject(NotificationService);

  show(message: string) {
    this.notifier.info(message);
  }

  showError(message: string) {
    this.notifier.error(message);
  }

  showSuccess(message: string) {
    this.notifier.success(message);
  }
}
