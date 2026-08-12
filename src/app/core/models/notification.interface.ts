export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationData {
  title: string;
  message?: string;
  /** Material icon name, e.g. 'check_circle' (used inside a <mat-icon>). */
  icon?: string;
  /** Semantic tone used to derive a default color. */
  type?: NotificationType;
  /** Custom CSS color (hex, hsl, var(--...)) that overrides the tone default. */
  color?: string;
  /** How long the notification stays visible, in milliseconds. Defaults to 3000. */
  duration?: number;
}

export interface Notification extends NotificationData {
  id: number;
  type: NotificationType;
  color: string;
  duration: number;
}
