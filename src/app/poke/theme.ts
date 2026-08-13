import { DOCUMENT, inject, signal, Service } from '@angular/core';
import { BrowserStorage } from '@core/services/storage';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'poke-league-theme';

/**
 * Applies a `data-theme` attribute on <html> (light/dark), mirrored by CSS
 * tokens. Also carries the `Theme` CSS-variable API (getRootVar /
 * setHue / setSat) so accent hues and saturations can be tweaked at runtime.
 */
@Service()
export class Theme {
  #document = inject(DOCUMENT);
  #storage = inject(BrowserStorage);

  readonly mode = signal<ThemeMode>(this.load());

  constructor() {
    this.apply(this.mode());
  }

  toggle(): void {
    this.set(this.mode() === 'light' ? 'dark' : 'light');
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
    this.apply(mode);
    this.#storage.set(STORAGE_KEY, mode);
  }

  private apply(mode: ThemeMode): void {
    this.#document.documentElement.dataset['theme'] = mode;
  }

  private load(): ThemeMode {
    const stored = this.#storage.get(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    // Always boot light regardless of OS preference, so the app never looks
    // like dark mode out of the box (users complained it was very dark).
    return 'light';
  }
}
