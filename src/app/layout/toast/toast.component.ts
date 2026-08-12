import { AfterViewInit, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Notification } from '@core/models/notification.interface';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss',
})
export class ToastComponent implements AfterViewInit {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  private dismissFn?: () => void;
  private exitResolve?: () => void;

  toast!: Notification;
  readonly isExiting = signal(false);
  readonly toastEl = viewChild.required<ElementRef<HTMLElement>>('toastEl');

  ngAfterViewInit(): void {
    this.toastEl().nativeElement.focus({ preventScroll: true });
  }

  registerDismiss(fn: () => void): void {
    this.dismissFn = fn;
  }

  /** Called by the service to trigger the exit animation. */
  startExit(): void {
    this.isExiting.set(true);
  }

  dismiss(): void {
    this.dismissFn?.();
  }

  onAnimationEnd(event: AnimationEvent): void {
    if (event.animationName === 'toast-exit' && this.exitResolve) {
      this.exitResolve();
    }
  }

  /** Resolves when the exit animation finishes (immediately if never exiting). */
  waitForExit(): Promise<void> {
    if (!this.isExiting()) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.exitResolve = resolve;
    });
  }
}
