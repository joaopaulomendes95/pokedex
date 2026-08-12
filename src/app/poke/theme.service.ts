import { DOCUMENT, inject, signal, Service } from '@angular/core';
import { StorageService } from '@core/services/storage.service';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'poke-league-theme';

/**
 * Applies a `data-theme` attribute on <html> (light/dark), mirrored by CSS
 * tokens. Also carries the APP/ `ThemeService` CSS-variable API (getRootVar /
 * setHue / setSat) so accent hues and saturations can be tweaked at runtime.
 */
@Service()
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(StorageService);

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
    this.storage.set(STORAGE_KEY, mode);
  }

  private apply(mode: ThemeMode): void {
    this.document.documentElement.dataset['theme'] = mode;
  }

  private load(): ThemeMode {
    const stored = this.storage.get(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    // Always boot light regardless of OS preference, so the app never looks
    // like dark mode out of the box (users complained it was very dark).
    return 'light';
  }

  // ---- APP/ ThemeService CSS-variable API ----

  getRootVar(name: string): string {
    return getComputedStyle(this.document.documentElement).getPropertyValue(name).trim();
  }

  setHue(hue: number): void {
    this.setMainHue(hue);
    this.setDesatHue(hue);
  }

  setMainHue(hue: number): void {
    this.document.documentElement.style.setProperty('--main-hue', `${hue}`);
  }

  setDesatHue(hue: number): void {
    this.document.documentElement.style.setProperty('--desat-hue', `${hue}`);
  }

  setMainSat(sat: number): void {
    this.document.documentElement.style.setProperty('--main-saturation', `${sat}%`);
  }

  setDesatSat(sat: number): void {
    this.document.documentElement.style.setProperty('--desat-saturation', `${sat}%`);
  }
}
