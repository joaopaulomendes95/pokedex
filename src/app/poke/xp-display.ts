import { inject, signal, Service } from '@angular/core';
import { BrowserStorage } from '@core/services/storage';

export type XpDisplayMode = 'flat' | 'pct';

const STORAGE_KEY = 'poke-league-xp-mode';

/** App-wide XP display preference (flat "123 / 2670 XP" vs "46%"). */
@Service()
export class XpDisplay {
  #storage = inject(BrowserStorage);

  readonly mode = signal<XpDisplayMode>(this.load());

  toggle(): void {
    this.mode.update((m) => (m === 'flat' ? 'pct' : 'flat'));
    this.#storage.set(STORAGE_KEY, this.mode());
  }

  private load(): XpDisplayMode {
    const stored = this.#storage.get(STORAGE_KEY);
    if (stored === 'flat' || stored === 'pct') return stored;
    return 'flat';
  }
}
