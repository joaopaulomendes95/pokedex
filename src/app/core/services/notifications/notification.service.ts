import { inject, Service } from '@angular/core';
import { Overlay, OverlayConfig, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { ToastComponent } from '@layout/toast/toast.component';
import {
  Notification,
  NotificationData,
  NotificationType,
} from '@core/models/notification.interface';

export const DEFAULT_NOTIFICATION_DURATION = 3000;

const TYPE_COLORS: Record<NotificationType, string> = {
  success: 'var(--color-green)',
  error: 'var(--color-red)',
  warning: 'var(--color-yellow)',
  info: 'var(--color-main-60)',
};

const TYPE_ICONS: Record<NotificationType, string> = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
};

interface ActiveToast {
  ref: OverlayRef;
  componentRef: { instance: ToastComponent };
  id: number;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Overlay-based toast notifications: each toast lives in its
 * own CDK overlay at the top-right, stacking downward so they never overlap.
 */
@Service()
export class NotificationService {
  private readonly overlay = inject(Overlay);
  private readonly toasts = new Map<number, ActiveToast>();
  private lastId = 0;

  show(data: NotificationData): number {
    const type = data.type ?? 'info';
    const id = ++this.lastId;

    const notification: Notification = {
      ...data,
      id,
      type,
      color: data.color ?? TYPE_COLORS[type],
      icon: data.icon ?? TYPE_ICONS[type],
      duration: data.duration ?? DEFAULT_NOTIFICATION_DURATION,
    };

    const config = this.createOverlayConfig(notification);
    const ref = this.overlay.create(config);

    const portal = new ComponentPortal(ToastComponent);
    const componentRef = ref.attach(portal);
    componentRef.instance.toast = notification;
    componentRef.instance.registerDismiss(() => this.dismiss(id));

    const timer = setTimeout(() => this.dismiss(id), notification.duration);

    this.toasts.set(id, { ref, componentRef, id, timer });

    return id;
  }

  dismiss(id: number): void {
    const toast = this.toasts.get(id);
    if (!toast) return;

    clearTimeout(toast.timer);

    toast.componentRef.instance.startExit();
    void toast.componentRef.instance.waitForExit().then(() => {
      toast.ref.dispose();
      this.toasts.delete(id);
    });
  }

  clear(): void {
    for (const toast of this.toasts.values()) {
      clearTimeout(toast.timer);
      toast.ref.dispose();
    }
    this.toasts.clear();
  }

  success(title: string, message?: string): number {
    return this.show({ title, message, type: 'success' });
  }

  error(title: string, message?: string): number {
    return this.show({ title, message, type: 'error' });
  }

  warning(title: string, message?: string): number {
    return this.show({ title, message, type: 'warning' });
  }

  info(title: string, message?: string): number {
    return this.show({ title, message, type: 'info' });
  }

  private createOverlayConfig(notification: Notification): OverlayConfig {
    // Stack each new toast below the ones already showing.
    const topRem = 1 + this.toasts.size * 4.6;
    return new OverlayConfig({
      positionStrategy: this.overlay
        .position()
        .global()
        .top(`${topRem}rem`)
        .right('1rem')
        .width('min(22rem, calc(100vw - 2rem))'),
      scrollStrategy: this.overlay.scrollStrategies.block(),
      hasBackdrop: false,
      panelClass: 'app-toast-overlay',
      disposeOnNavigation: true,
    });
  }
}
