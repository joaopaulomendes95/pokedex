import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID, Service } from '@angular/core';

/**
 * Thin, environment-safe localStorage wrapper:
 * guards against non-browser platforms and keeps persistence calls in one place.
 */
@Service()
export class BrowserStorage {
  #isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  get(key: string): string | null {
    if (!this.#isBrowser) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  set(key: string, value: string): void {
    if (!this.#isBrowser) return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // storage blocked (private mode) — keep state in memory
    }
  }

  remove(key: string): void {
    if (!this.#isBrowser) return;
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
