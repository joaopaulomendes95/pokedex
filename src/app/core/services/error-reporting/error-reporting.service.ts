import { Service, signal } from '@angular/core';

export interface ErrorReportEntry {
  message: string;
  source: string;
  url: string;
  at: number;
}

const MAX_RETAINED = 20;

/**
 * In-memory error sink  here we keep the last N
 * errors in a signal so the game can surface them (e.g. on the Save screen).
 */
@Service()
export class ErrorReportingService {
  /** Recent captured errors, newest first. */
  readonly errors = signal<ErrorReportEntry[]>([]);

  reportError(message: string, source: string, url: string): void {
    this.errors.update((list) =>
      [{ message, source, url, at: Date.now() }, ...list].slice(0, MAX_RETAINED),
    );
    // Always surface to the console for debuggability.
    console.error(`[error-report] ${message}`, source);
  }

  clear(): void {
    this.errors.set([]);
  }
}
