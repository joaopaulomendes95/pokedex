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

**No router** — screens are tabs driven by `UiState` signals; the root
component (`app.ts`) renders `<app-navbar>` + `<app-poke-hub>`.

## Commands

- `npm start` — dev server. `npm run build` — production build (budgets:
  `anyComponentStyle` warns at 6 kB, errors at 8 kB, so oversized SCSS breaks
  the prod build only). Build output goes to `dist/pokedex`.
- `npm test` — vitest under the hood (`@angular/build:unit-test`, `jsdom`;
  no Karma, no config file needed). Spec pattern is `describe/it/expect`.
  Tests are signal-driven, so call `fixture.detectChanges()` /
  `await fixture.whenStable()` after state changes. Import vitest helpers
  (`import { describe, expect, it } from 'vitest'`) explicitly.
- `npm run lint` — ESLint (`ng lint`, angular-eslint flat config in
  `eslint.config.js`). Generated `shared/openapi` and `dist/` are ignored;
  keep the run green. Format with `npx prettier --write .` (singleQuote,
  printWidth 100, angular HTML parser).

## Structure & conventions

- **Path aliases** (tsconfig `paths`, no `baseUrl`): `@app/*`, `@core/*`,
  `@shared/*`, `@layout/*`, `@poke/*`. Use them in every import; do not add
  `baseUrl` (deprecated in TS 6).
- **Services**: root services use the Angular 22 **`@Service()`** decorator
  and **`inject()`** — no constructor DI (NG2028 forbids it). Inject via
  class fields (`#x = inject(X)`).
- **Infra lives in `core/`**: `config/game.config.ts` (`GAME_CONFIG` token +
  `DEFAULT_GAME_CONFIG`), `handlers/global-error-handler.ts` (wired in
  `app.config.ts` via `{ provide: ErrorHandler, useClass }`),
  `services/storage.ts` (the only place that touches `localStorage`),
  `services/notifications/notification.ts` (CDK-overlay toasts),
  `services/error-reporting/error-reporting.ts`,
  `services/save-io/` (save import/export: localStorage is origin-scoped, so a
  dev-port change looks like a wiped save — `SaveIo` bundles the game, missions
  and Elite Series keys into one JSON file for port/browser portability),
  `models/*`.
- **UI building blocks in `shared/ui/`**: `basic-view`,
  `kpi-block`, `custom-chip`, `progress-gauge`, `container-mark`,
  `object-container`, `general-tile-list` (+ `GeneralListBase` engine),
  `custom-spinner` (the bouncer loader), `battle-log` (battle narration
  timeline), and the dialog system (`AppDialog`, `ConfirmationDialog`,
  `ResultDialog`, `DetailsDialog`,
  `DetailsSections`). Re-exported through `shared/ui/index.ts`.
  Domain-neutral models shared by UI and features live in `shared/models/`
  (e.g. `battle-event.ts`) so `shared/` never imports from `poke/`.
  Global design tokens are in `src/styles/_tokens.scss`, prefixed `--app-`;
  component-scoped CSS vars are kebab-case + component name.
- **Layout** in `layout/`: `navbar` (hover-expand, theme + Shop buttons,
  coins/energy), `toast`, `loaders/pop-loader`.

## Architecture gotchas (verify before assuming generics)

- App is **zoneless** (`provideZonelessChangeDetection()` in
  `app.config.ts`). All state lives in `signal()`s; edit via `.set/.update`,
  structure templates with `@if/@for/@switch`. Do not add
  `ZoneProvider`/`NgZone`.
- Strict TS is **on** (`strict` + `noUncheckedIndexedAccess` in `tsconfig.json`).
  `strictTemplates` stays off, so don't rely on template type errors alone.
- **httpResource** (`poke/poke-data.ts`): JSON is the default parse —
  there is **no `.json()` sub-constructor**; use `httpResource.text()` when
  you need a string body. The `parse` option transforms the raw body. A
  request factory that returns `undefined` keeps the resource Idle (that's
  how the cache short-circuits a repeat fetch). `isLoading()`, `error()`,
  `reload()` are available on the ref; `warmup()`/`ensureInCache()` drive
  `selected` to pre-populate the detail cache for battle.

- **PokeAPI data flow**: `PokeData` exposes `dex()` (current page of
  30 creatures, from `/pokemon?limit=30&offset=N`), `detail()` (from the
  `selected` signal, cached by name), `spriteUrlOrEmpty(name)` (cached detail
  sprite, falling back to the dex-derived CDN URL), plus **dex pagination**:
  `dexPage()` signal with `nextDexPage()`, `prevDexPage()`, `dexTotal()`,
  `dexMaxPage()`, `hasPrevPage()`, `hasNextPage()`. Three more generated
  resources feed the game: `moveByName()`/`ensureMoves()` (real moves from
  `/move/:name`, driving the battle sim), `speciesFlavor()`/`ensureSpecies()`
  (English dex entry from `/pokemon-species/:name`) and
  `evolutionFor()`/`ensureChainFor()` (flattened `/evolution-chain/:id`). All
  fetches go through the Orval-generated `*Resource` functions (no hand-rolled
  URLs); the live app needs the network at runtime; there is **no local
  snapshot**. Clients are Orval-generated from `tools/pokeapi.openapi.yml`
  into `shared/openapi/poke-api/`.

- `poke/adventure-regions.ts` — the adventure **world map**: 13 curated
  regions (all with real, verified `location-area` IDs) grouped into **5
  macro-zones** (`WORLD_ZONES`: Kanto · Johto&Hoenn · Sinnoh&Unova ·
  Kalos&Alola · Galar). The map is **generation-gated**: `groupedRegions(maxGen)`
  shows only the zones/regions within the save's generation (no locked cards),
  so a save's regions always cover every gen ≤ maxGen and the Pokédex of that
  generation can be completed. Adventure flow is fight-to-catch: pick a region →
  "Go catch some" fetches a shuffled wild pool (`PokeData.zonePool`, capped by
  the save's gen + master-list membership), pick one and FIGHT it (Battle sim,
  1v1 vs your strongest owned) — winning gives a chance to throw a ball (catch +
  1/64 shiny roll). The pool is first-evolutions-only, weighted to the region's
  strongest species with random picks mixed in, and re-rolls on a TTL
  (`POOL_TTL_MS`) like random encounters.

- `poke/game.ts` is the state machine: `coins`, `collection`
  (name → `OwnedPoke`), `squad` (max 6), `wins`, `tier`. `tick()` (1s
  interval) accrues `incomePerSec` **and** passive XP to the _whole_
  collection (`passiveXpPerSec`, scaled by tier) and regenerates squad
  energy. `award(winner)` pays coins + XP to the squad; `promote()` moves the
  ladder. **No auto-level**: XP banks up and a pokémon stays ready
  (`pendingLevels(name)`) until the player clicks `applyLevelUps(name)` (free,
  click-to-level). Paid +1 levels go through `spend` + `addLevel`. **Evolve**:
  `evolve(from, to)` swaps the species while keeping level/XP and the fielded
  slot (readiness comes from the evolution-chain cache). `add(name, level,
shiny)` — catches roll a 1/64 shiny variant (`OwnedPoke.shiny`, ✨ badge +
  shiny sprite). Persisted via `BrowserStorage` to `poke-league-save` with
  offline coins+XP on restore.

  **Idle mechanics**: `incomePerSec` scales with collection size;
  `stats()` signal tracks career counters (`battles`, `wins`, `catches`,
  `coinsEarned`, `levelUps`); `prestige` shards (earned by resetting at
  Champion Cup) permanently boost idle income (+25%/shard) and passive XP
  (+1/sec/shard). `canPrestige()` / `prestigeReset()` / `prestigeGain()`.
  Economy constants come from `GAME_CONFIG` (energy, regen, offline cap,
  squad max, starters).

- **Reactivity**: the app is zoneless + signal-driven, so the 1s ticker
  updating `coins`/`energy`/`collection`/`stats` re-renders any template that
  reads them with no manual CD. Do NOT call `ApplicationRef.tick()` manually —
  in dev mode it runs `checkNoChanges` on every view and throws
  `ExpressionChanged` with a live game.

- `poke/missions.ts` — mission catalog (8 missions) with **infinite tiers**: each
  tier doubles goals/rewards, and claiming everything advances the tier
  (bump-before-persist + a load-time guard skip past fully-claimed tiers, so
  missions can never soft-lock). Claim counts per base mission persist in
  `poke-league-missions`; `resetAll()` wipes everything. `readyCount()` feeds
  the navbar Idle badge, and a root effect toasts newly-claimable missions
  (and tier unlocks) whenever the player is on another tab.

- `poke/daily-challenge.ts` — the daily challenge ladder (win 1 → 3 → 5 → 10
  battles today, rewards per stage, resets on date change; losses don't reset
  progress; pure `dailyChallengeStatus` is unit-tested).
- `PokeData.isApex`/`isFinalForm` — single-stage pokémon get an apex +8% stat
  bonus (they can't evolve) and clear "final form"/"apex" labels everywhere.

- `poke/achievements.ts` — permanent one-time goals (auto-rewarded with coins
  - toast the moment their predicate flips; persisted per save across
    prestiges). `poke/daily-reward.ts` — daily login streak reward (`dailyStatus`
    is a pure, unit-tested function; streak grows by returning day after day and
    resets when a day is missed).

- `poke/summon.ts` — the gacha engine (Summon Portal tab): coin-powered pulls on
  three tiers (Basic/Advanced/Legendary) with per-rarity drop rates, pity
  counters that guarantee the tier floor (Rare+ every 10 / Epic+ every 8 /
  Legendary every 5), and a one-time parallel rarity-band warmup
  (`PokeData.fetchDetailParallel` — the only concurrent-safe detail fetch).
  Squad type synergy: 3+ fielded pokémon sharing a primary type get +10% stats
  (`SYNERGY_MIN`/`SYNERGY_MULT` in battle.ts).

- `poke/boost.ts` — the Focus burst (Swarm-Sim-style mutation): spend 25 squad
  energy for a 60s ×2 income + ×2 passive XP window (no circular DI — the UI
  spends energy, Game reads the multiplier). `Game.elder` — Elder Shards, the
  second prestige layer (+5% income each, never reset), earned by completing
  the daily challenge ladder.

- `poke/auto-battle.ts` — idle loop running quick fights every ~4s.
  `toggle()` starts/stops; inject into Arena for the UI button.

- `poke/manual-battle.ts` — **player-controlled turn-by-turn battles** (the
  "real Pokémon game" mode): each round the player picks one of their
  pokémon's real moves, both sides strike by speed initiative, hp is applied
  immutably. Reuses `resolveExchange` (the same pure damage formula + type
  chart as the sim) and `chooseMove` for the rival AI. Arena pays out once
  when a manual battle ends, plus a per-fighter XP boost.

- `poke/battle.ts` — `simulate(player, rival, rng)` is a **pure**
  turn-based sim (rng injected → deterministic, fully unit-tested). Fighters
  carry a real moveset (`Fighter.moves`, from PokeAPI `/move/:name`);
  `chooseMove` picks the best move vs the defender via the type chart;
  `resolveExchange(attacker, defender, move, actor, rng)` is the shared pure
  single-strike used by both the sim and manual battles. Type multipliers
  live in `poke/type-chart.ts`. `MatchRunner`
  (`poke/match.runner.ts`) wraps it for the live arena: INSTANT result, a
  `summary()` (damage/knockouts/fainted per side) and a **one-shot `settled`
  guard** — `collect()` pays out at most once per match (no coin farming).
  Winning fighters earn a personal XP boost on top of the squad award.

- `poke/tournament.ts` — cups are **tier-gated** (`minTier`): Rookie →
  Silver → Pro → Grand → Champion, with escalating rivals/prizes; at tier 4+
  `generateInfiniteCups(tier)` produces an ever-harder Elite Series.

- **Shop & Bag** (`poke/features/shared/shop-dialog/`): the single
  buy+use-items modal, opened from the navbar `storefront` button
  (slide-in-from-right, `details-dialog` panel class). Prices scale by tier;
  consumables restore squad energy. There is **no Market tab** — the Shop
  modal replaces it. The stats/training "Poké-Card" is the shared
  `poke/features/shared/detail-panel/` used by the Pokédex and the Squad
  inspector. Idle economy helpers (`trainCost`, `xpForLevel`) live in
  `poke/economy.ts`.

- **Toasts** go through `poke/notify.ts` (`show`/`showError`/
  `showSuccess`), which delegates to the overlay `Notifier`. Keep
  call sites on the facade; do not use `MatSnackBar` directly.

- `public/` only holds `favicon.ico` — the game is 100% API-driven.
