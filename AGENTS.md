# AGENTS.md

Angular 22 standalone-component app (Angular Material, SCSS), zoneless.
A Pokémon-style **idle auto-battler** ("Poké-Liga Idle"): field a squad,
fight instant auto-resolved battles, collect coins (idle income every real
second + match payouts), buy/train creatures, and climb a 5-tier ladder
(Novice → Champion Cup) into infinite Elite Series.

Everything above a thin UI shell is powered by `httpResource` from the
**PokeAPI** (free, keyless, CORS-open) — the dex list is one static request
and the card detail is a **request derived from a signal** (`selected()`),
with an in-memory cache so flipping the dex never re-fetches.

> The project is a **training ground for the work codebase** (the `APP/`
> reference lives outside this repo): it mirrors the same architecture —
> path aliases, `@Service()` + `inject()`, overlay toasts, injection-token
> config, global error handling — so every pattern used here transfers.

**No router** — screens are tabs driven by `UiStateService` signals; the root
component (`app.component.ts`) renders `<app-navbar>` + `<app-poke-hub>`.

## Commands

- `npm start` — dev server. `npm run build` — production build (budgets:
  `anyComponentStyle` warns at 6 kB, errors at 8 kB, so oversized SCSS breaks
  the prod build only). Build output goes to `dist/pokedex`.
- `npm test` — vitest under the hood (`@angular/build:unit-test`, `jsdom`;
  no Karma, no config file needed). Spec pattern is `describe/it/expect`.
  Tests are signal-driven, so call `fixture.detectChanges()` /
  `await fixture.whenStable()` after state changes. Import vitest helpers
  (`import { describe, expect, it } from 'vitest'`) explicitly.
- No lint script; format with `npx prettier --write .` (singleQuote,
  printWidth 100, angular HTML parser).

## Structure & conventions

- **Path aliases** (tsconfig `paths`, no `baseUrl`): `@app/*`, `@core/*`,
  `@shared/*`, `@layout/*`, `@poke/*`. Use them in every import; do not add
  `baseUrl` (deprecated in TS 6).
- **Services**: root services use the Angular 22 **`@Service()`** decorator
  and **`inject()`** — no constructor DI (NG2028 forbids it). Inject via
  class fields (`private readonly x = inject(X)`).
- **Infra lives in `core/`**: `config/game.config.ts` (`GAME_CONFIG` token +
  `DEFAULT_GAME_CONFIG`), `handlers/global-error-handler.ts` (wired in
  `app.config.ts` via `{ provide: ErrorHandler, useClass }`),
  `services/storage.service.ts` (the only place that touches `localStorage`),
  `services/notifications/notification.service.ts` (CDK-overlay toasts),
  `services/error-reporting/error-reporting.service.ts`, `models/*`.
- **UI building blocks in `shared/ui/`** (ported from `APP/`): `basic-view`,
  `kpi-block`, `custom-chip`, `progress-gauge`, `container-mark`,
  `object-container`, `general-tile-list` (+ `GeneralListBase` engine), and
  the dialog system (`AppDialogService`, `ConfirmationDialogComponent`,
  `FormDialogComponent`, `ResultDialogComponent`, `DetailsBlockComponent`,
  `DetailsSectionsComponent`). Re-exported through `shared/ui/index.ts`.
- **Layout** in `layout/`: `navbar` (hover-expand, theme + Shop buttons,
  coins/energy), `toast`, `loaders/pop-loader`.

## Architecture gotchas (verify before assuming generics)

- App is **zoneless** (`provideZonelessChangeDetection()` in
  `app.config.ts`). All state lives in `signal()`s; edit via `.set/.update`,
  structure templates with `@if/@for/@switch`. Do not add
  `ZoneProvider`/`NgZone`.
- Strict TS is **off** (no `"strict"`/`strictTemplates` in any tsconfig).
  Don't rely on type-error removal to catch template mistakes.
- **httpResource** (`poke/poke-data.service.ts`): JSON is the default parse —
  there is **no `.json()` sub-constructor**; use `httpResource.text()` when
  you need a string body. The `parse` option transforms the raw body. A
  request factory that returns `undefined` keeps the resource Idle (that's
  how the cache short-circuits a repeat fetch). `isLoading()`, `error()`,
  `reload()` are available on the ref; `warmup()`/`ensureInCache()` drive
  `selected` to pre-populate the detail cache for battle.

- **PokeAPI data flow**: `PokeDataService` exposes `dex()` (current page of
  30 creatures, from `/pokemon?limit=30&offset=N`), `detail()` (from the
  `selected` signal, cached by name), `spriteUrlOrEmpty(name)` (cached detail
  sprite, falling back to the dex-derived CDN URL), plus **dex pagination**:
  `dexPage()` signal with `nextDexPage()`, `prevDexPage()`, `dexTotal()`,
  `dexMaxPage()`, `hasPrevPage()`, `hasNextPage()`. The live app needs the
  network at runtime; there is **no local snapshot**. Clients are
  Orval-generated from `tools/pokeapi.openapi.yml` into `poke/poke-api/`.

- `poke/game.service.ts` is the state machine: `coins`, `collection`
  (name → `OwnedPoke`), `squad` (max 6), `wins`, `tier`. `tick()` (1s
  interval) accrues `incomePerSec` **and** passive XP to the _whole_
  collection (`passiveXpPerSec`, scaled by tier) and regenerates squad
  energy. `award(winner)` pays coins + XP to the squad; `promote()` moves the
  ladder. **No auto-level**: XP banks up and a pokémon stays ready
  (`pendingLevels(name)`) until the player clicks `applyLevelUps(name)` (free,
  click-to-level). Paid +1 levels go through `spend` + `addLevel`. Persisted
  via `StorageService` to `poke-league-save` with offline coins+XP on restore.

  **Idle mechanics**: `incomePerSec` scales with collection size;
  `stats()` signal tracks career counters (`battles`, `wins`, `catches`,
  `coinsEarned`, `levelUps`); `prestige` shards (earned by resetting at
  Champion Cup) permanently boost idle income (+25%/shard) and passive XP
  (+1/sec/shard). `canPrestige()` / `prestigeReset()` / `prestigeGain()`.
  Economy constants come from `GAME_CONFIG` (energy, regen, offline cap,
  squad max, starters).

- **Reactivity**: the ticker also runs `detectChanges()` + an `opacity`
  paint nudge on `app-root` every second (wired via `GameService.registerTickHook`).
  Do NOT call `ApplicationRef.tick()` manually — in dev mode it runs
  `checkNoChanges` on every view and throws `ExpressionChanged` with a live
  game.

- `poke/missions.service.ts` — mission catalog (8 missions), progress derived
  from `GameService.stats()`, claimed-set persisted to `poke-league-missions`.
  `claim(mission)` pays coins once.

- `poke/auto-battle.service.ts` — idle loop running quick fights every ~4s.
  `toggle()` starts/stops; inject into Arena for the UI button.

- `poke/battle.service.ts` — `simulate(player, rival, rng)` is a **pure**
  turn-based sim (rng injected → deterministic, fully unit-tested). Type
  multipliers live in `poke/type-chart.ts`. `MatchRunner`
  (`poke/match.runner.ts`) wraps it for the live arena: INSTANT result, a
  `summary()` (damage/knockouts/fainted per side) and a **one-shot `settled`
  guard** — `collect()` pays out at most once per match (no coin farming).

- **Shop & Bag** (`poke/features/shared/shop-dialog/`): the single
  buy+use-items modal, opened from the navbar `storefront` button
  (slide-in-from-right, `details-dialog` panel class). Prices scale by tier;
  consumables restore squad energy. There is **no Market tab** — the Shop
  modal replaces it. The stats/training "Poké-Card" is the shared
  `poke/features/shared/detail-panel/` used by the Pokédex and the Squad
  inspector. Idle economy helpers (`trainCost`, `xpForLevel`) live in
  `poke/economy.ts`.

- **Toasts** go through `poke/notify.service.ts` (`show`/`showError`/
  `showSuccess`), which delegates to the overlay `NotificationService`. Keep
  call sites on the facade; do not use `MatSnackBar` directly.

- `public/` only holds `favicon.ico` — the game is 100% API-driven.
