# AGENTS.md

Angular 22 standalone-component app (Angular Material, SCSS). A Pokémon-style
**idle auto-battler** ("Poké-Liga Idle"): field a squad of 3, fight instant
auto-resolved battles, collect coins (idle income every real second + match
payouts), spend coins in the Market to buy new creatures or **train** owned
ones (+1 level), and climb a 5-tier ladder (Novice → Champion Cup).

Everything above a thin UI shell is powered by `httpResource` from the
**PokeAPI** (free, keyless, CORS-open) — the dex list is one static request
and the card detail is a **request derived from a signal** (`selected()`),
with an in-memory cache so flipping the dex never re-fetches.

**No router** — screens are Material tabs in `poke/features/poke-hub/`, and
the root component (`app.component.ts`, bootstrapped in `main.ts`) just
renders `<app-poke-hub />`.

## Commands

- `npm start` — dev server. `npm run build` — production build (note budgets:
  `anyComponentStyle` warns at 4 kB, errors at 8 kB, so oversized SCSS breaks
  the prod build only).
- `npm test` — vitest under the hood (`@angular/build:unit-test`, `jsdom`;
  no Karma, no config file needed). Spec pattern is `describe/it/expect`.
  Tests are all signal-driven, so call `fixture.detectChanges()` /
  `await fixture.whenStable()` after state changes. Import the vitest
  helpers (`import { describe, expect, it } from 'vitest'`) explicitly.
- No lint script; format with `npx prettier --write .` (config:
  singleQuote, printWidth 100, angular HTML parser).

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
  network at runtime; there is **no local snapshot** anymore.

- `poke/game.service.ts` is the state machine: `coins`, `collection`
  (name → `OwnedPoke`), `squad` (max 3), `wins`, `tier`. `tick()` accrues
  `incomePerSec` **and** passive XP every second to the _whole_ collection
  (`passiveXpPerSec`, scaled by tier); `award(winner)` pays coins + XP to the
  squad; `promote()` moves the ladder. **No auto-level**: XP banks up and a
  pokémon stays ready (`pendingLevels(name)`) until the player clicks
  `applyLevelUps(name)` (free, click-to-level). Paid +1 levels still go
  through `spend` + `addLevel`. Persisted to `localStorage`
  (`poke-league-save`) with offline coins+XP on restore.

  **New idle mechanics**: `incomePerSec` scales with collection size;
  `stats()` signal tracks career counters (`battles`, `wins`, `catches`,
  `coinsEarned`, `levelUps`); `prestige` shards (earned by resetting at
  Champion Cup) permanently boost idle income (+25%/shard) and passive XP
  (+1/sec/shard). `canPrestige()` / `prestigeReset()` / `prestigeGain()`.

- `poke/missions.service.ts` — mission catalog (8 missions), progress derived
  from `GameService.stats()`, claimed-set persisted to `localStorage`
  (`poke-league-missions`). `claim(mission)` pays coins once.

- `poke/auto-battle.service.ts` — idle loop running quick fights (5 energy)
  every ~2s. `toggle()` starts/stops; inject into Arena for UI button.

- `poke/battle.service.ts` — `simulate(player, rival, rng)` is a **pure**
  turn-based sim (rng injected → deterministic, fully unit-tested). Type
  multipliers live in `poke/type-chart.ts`. `MatchRunner`
  (`poke/match.runner.ts`) wraps it for the live arena: INSTANT result, a
  `summary()` (damage/knockouts/fainted per side) and a **one-shot `settled`
  guard** — `collect()` pays out at most once per match (no coin farming).

- Market (`poke/features/market/`): paged dex grid, buy new creatures
  (price from raw stat totals) and **train** owned ones
  (`trainCost(level)`, `+1 level`). The stats/training "Poké-Card" is a
  **shared component** `poke/features/shared/detail-panel/` used by BOTH the
  Market (`app-poke-detail-panel`) and the Squad collection inspector. Idle
  economy helpers (`trainCost`, `xpForLevel`) live in `poke/economy.ts`.

- **Reusable UI components** (`poke/shared/ui/`): `CustomChipComponent`,
  `KpiBlockComponent`, `ProgressGaugeComponent`, `ContainerMarkComponent`,
  `BasicViewComponent`, `ObjectContainerComponent`, `DialogService` +
  `ConfirmationDialogComponent`, `FormDialogComponent`. Used in Quests/Idle
  tab; `MatDialogModule` registered in `app.config.ts`.

- `public/` currently only holds `favicon.ico` — no data assets, the game is
  100% API-driven.

- The old FIFA draft game (`core/`, `shared/`, old `features/`,
  `public/data/fc/players.json`, `tools/build-player-data.mjs`) was
  **deleted** — do not reintroduce it.

## Stale docs

`README.md` lags reality — it still describes the deleted openfootball /
worldcup.json fetch and the FIFA draft. Skim it for ideas only; trust the
code/config over it.
