import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { SaveIo, SAVE_KEYS } from '@core/services/save-io/save-io';
import { BrowserStorage } from '@core/services/storage';
import { Game, SAVE_KEY } from '@poke/game';
import { MISSIONS_KEY } from '@poke/missions';
import { ELITE_SERIES_KEY } from '@poke/elite-series';

/** In-memory BrowserStorage so export/import round-trips can be asserted. */
function fakeStorage(): BrowserStorage {
  const map = new Map<string, string>();
  return {
    get: (k: string) => map.get(k) ?? null,
    set: (k: string, v: string) => void map.set(k, v),
    remove: (k: string) => void map.delete(k),
  } as unknown as BrowserStorage;
}

describe('SaveIo', () => {
  it('export produces a file containing every save key', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: BrowserStorage, useValue: fakeStorage() }],
    });
    const io = TestBed.inject(SaveIo);
    const file = JSON.parse(io.buildExport()) as { app: string; data: Record<string, unknown> };
    expect(file.app).toBe('poke-liga-idle');
    expect(SAVE_KEYS.every((k) => k in file.data)).toBe(true);
    expect((file.data[SAVE_KEY] as { collection: unknown[] }).collection).toBeDefined();
  });

  it('rejects junk, foreign saves and empty files', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: BrowserStorage, useValue: fakeStorage() }],
    });
    const io = TestBed.inject(SaveIo);
    expect(io.validateImport('not json at all')).toMatch(/JSON/i);
    expect(io.validateImport(JSON.stringify({ app: 'some-other-app', data: {} }))).toMatch(
      /poké-liga/i,
    );
    expect(io.validateImport(JSON.stringify({ app: 'poke-liga-idle', data: {} }))).toMatch(
      /empty/i,
    );
  });

  it('round-trips an export back into storage via applyImport', () => {
    const store = fakeStorage();
    TestBed.configureTestingModule({
      providers: [{ provide: BrowserStorage, useValue: store }],
    });
    const io = TestBed.inject(SaveIo);
    TestBed.inject(Game).add('pikachu', 5); // some state to persist
    const exported = io.buildExport();

    // Fresh storage (like a new port/origin) with no save at all.
    for (const k of SAVE_KEYS) store.remove(k);
    expect(store.get(SAVE_KEY)).toBeNull();

    expect(io.applyImport(exported)).toBe(true);
    expect(store.get(SAVE_KEY)).not.toBeNull();
    expect(store.get(MISSIONS_KEY)).not.toBeNull();
    expect(store.get(ELITE_SERIES_KEY)).not.toBeNull();
    // The imported save restored the caught pokémon.
    const restored = JSON.parse(store.get(SAVE_KEY)!) as { collection: { name: string }[] };
    expect(restored.collection.some((p) => p.name === 'pikachu')).toBe(true);
  });

  it('applyImport refuses invalid files without touching storage', () => {
    const store = fakeStorage();
    TestBed.configureTestingModule({
      providers: [{ provide: BrowserStorage, useValue: store }],
    });
    const io = TestBed.inject(SaveIo);
    // Game seeds a save at boot, so capture it and assert it stays untouched.
    const before = store.get(SAVE_KEY);
    expect(io.applyImport('garbage')).toBe(false);
    expect(store.get(SAVE_KEY)).toBe(before);
    expect(store.get(MISSIONS_KEY)).toBeNull();
  });
});
