import { inject, Service } from '@angular/core';
import { BrowserStorage } from '@core/services/storage';
import { Game, SAVE_KEY } from '@poke/game';
import { Missions, MISSIONS_KEY } from '@poke/missions';
import { EliteSeries, ELITE_SERIES_KEY } from '@poke/elite-series';

/** localStorage keys that together make up a full save file. */
export const SAVE_KEYS = [SAVE_KEY, MISSIONS_KEY, ELITE_SERIES_KEY] as const;

/** Marker written into every export so imports can be validated. */
export const SAVE_FILE_APP = 'poke-liga-idle';
export const SAVE_FILE_VERSION = 1;

interface SaveFile {
  app: typeof SAVE_FILE_APP;
  version: number;
  exportedAt: string;
  data: Record<string, unknown>;
}

/**
 * Save import/export. The game lives in localStorage, which is scoped by
 * origin (scheme + host + PORT) — a dev-server port change means a brand-new
 * empty storage bucket, which looks exactly like a wiped save. Exporting a
 * JSON file and importing it again makes the save portable across ports,
 * browsers and machines.
 */
@Service()
export class SaveIo {
  #storage = inject(BrowserStorage);
  #game = inject(Game);
  #missions = inject(Missions);
  #elite = inject(EliteSeries);

  /**
   * Serialize the whole save (game + missions + elite series) into a JSON
   * file payload. Every piece is flushed to storage first so the file is exact.
   */
  buildExport(): string {
    this.#game.saveNow();
    this.#missions.flush();
    this.#elite.flush();
    const data: Record<string, unknown> = {};
    for (const key of SAVE_KEYS) {
      const raw = this.#storage.get(key);
      if (raw) {
        try {
          data[key] = JSON.parse(raw);
        } catch {
          data[key] = raw; // keep the raw string if it isn't valid JSON
        }
      }
    }
    const file: SaveFile = {
      app: SAVE_FILE_APP,
      version: SAVE_FILE_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    };
    return JSON.stringify(file, null, 2);
  }

  /**
   * Validate an imported file payload. Returns an error message when the file
   * isn't a Poke-Liga save, null when it looks valid.
   */
  validateImport(text: string): string | null {
    let file: unknown;
    try {
      file = JSON.parse(text);
    } catch {
      return 'That file is not valid JSON.';
    }
    if (typeof file !== 'object' || file === null) return 'Not a save file.';
    const f = file as Partial<SaveFile>;
    if (f.app !== SAVE_FILE_APP) return 'Not a Poké-Liga Idle save file.';
    if (typeof f.data !== 'object' || f.data === null) return 'Save file has no data.';
    const keys = Object.keys(f.data);
    if (keys.length === 0) return 'Save file is empty.';
    const known = new Set<string>(SAVE_KEYS);
    if (!keys.some((k) => known.has(k))) {
      return 'No recognized save data found in this file.';
    }
    return null;
  }

  /**
   * Write an imported file's payload into localStorage. Returns false when the
   * file is invalid (nothing is written in that case).
   */
  applyImport(text: string): boolean {
    const error = this.validateImport(text);
    if (error) return false;
    const f = JSON.parse(text) as SaveFile;
    for (const [key, value] of Object.entries(f.data)) {
      if ((SAVE_KEYS as readonly string[]).includes(key) && value !== undefined) {
        this.#storage.set(key, JSON.stringify(value));
      }
    }
    return true;
  }
}
