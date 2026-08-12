import { inject, signal, Service } from '@angular/core';
import { StorageService } from '@core/services/storage.service';

export type XpDisplayMode = 'flat' | 'pct';

const STORAGE_KEY = 'poke-league-xp-mode';

/** App-wide XP display preference (flat "123 / 2670 XP" vs "46%"). */
@Service()
export class XpDisplayService {
  private readonly storage = inject(StorageService);

  readonly mode = signal<XpDisplayMode>(this.load());

  toggle(): void {
    this.mode.update((m) => (m === 'flat' ? 'pct' : 'flat'));
    this.storage.set(STORAGE_KEY, this.mode());
  }

  label(flat: string, pct: number): string {
    return this.mode() === 'pct' ? `${pct}%` : flat;
  }

  private load(): XpDisplayMode {
    const stored = this.storage.get(STORAGE_KEY);
    if (stored === 'flat' || stored === 'pct') return stored;
    return 'flat';
  }
}