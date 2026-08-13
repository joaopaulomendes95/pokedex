# Poké-Liga Idle

A Pokémon-style **idle auto-battler** built with **Angular 22** (standalone
components, zoneless, signals) + **Angular Material**. Field a squad, fight
instant auto-resolved battles, collect coins (idle income every real second +
match payouts), buy/train creatures, and climb a 5-tier ladder (Novice →
Champion Cup) into infinite Elite Series.

## Commands

```bash
npm start       # dev server (http://localhost:4200)
npm run build   # production build (style budgets: anyComponentStyle 4kB warn / 8kB error)
npm test        # vitest under the hood (@angular/build:unit-test, jsdom), 38 tests
npx prettier --write .   # formatting (singleQuote, printWidth 100)
```

No router — screens are tabs driven by `UiState` signals; the root
component renders `<app-navbar>` + `<app-poke-hub>`.

## Gameplay

- **Idle loop** — `Game` ticks every real second: coins accrue
  (`incomePerSec`, scaled by collection size + prestige shards), squad energy
  regenerates, and the whole collection banks passive XP.
- **Squad** — field up to 6 creatures, drag to reorder, train (+1 level),
  apply banked XP level-ups (flat `123 / 2670 XP` or `%` display).
- **Pokédex** — paged dex with global search over all 10k Pokémon; detail
  panel to buy new creatures (price = raw stat totals) and train owned ones.
  Backed by the **PokeAPI** through generated `httpResource` services.
- **Adventure** — explore regions and catch wild Pokémon (Pokéballs consumed,
  catch chance by base exp).
- **Arena** — instant quick fights (5 energy) + **tournaments/cups** with an
  entry fee and prize pool; win battles in a row to lift the cup (run state
  survives tab switches via `CupRuns`). Auto-fight grinds while you
  watch.
- **Shop & Bag** — one modal (navbar `storefront` icon), slide-in from the
  right: buy items (prices scale by tier) and use consumables (restore squad
  energy) any time, even mid-tournament.
- **Idle / Quests** — mission catalog (8 missions) derived from career
  counters; claim coins once.
- **Save** — everything persists to `localStorage` (`poke-league-save`),
  including offline coins + XP while closed; restart a run (pick a
  generation), or **prestige** at Champion Cup for permanent +25% idle income
  and +1 XP/s per shard.

## Architecture

```
src/app/
├── core/          # cross-cutting infra
│   ├── config/       GAME_CONFIG injection token (energy, economy, roster)
│   ├── handlers/     GlobalErrorHandler
│   ├── models/       shared interfaces (dialogs, notifications, loader)
│   └── services/     BrowserStorage, Notifier (CDK overlay toasts),
│                     AppLoader, ErrorReporting
├── layout/        # navbar + toast + pop-loader
├── poke/          # the game
│   ├── features/     squad-builder, pokedex, adventure, arena, user, quests,
│   │                 shared (detail-panel, shop-dialog, poke-details-content)
│   └── *.ts          game (state machine), poke-data,
│                     match.runner, battle, missions, auto-battle,
│                     cup-run, theme, xp-display, ui-state
└── shared/ui/     # reusable design system: basic-view,
                   # kpi-block, custom-chip, progress-gauge, container-mark,
                   # object-container, general-tile-list + dialog system
```

Key patterns:

- **Zoneless + signals** — all state lives in `signal()`s; templates use
  `@if/@for/@switch`. No `NgZone`. `provideZonelessChangeDetection()` in
  `app.config.ts`.
- **`@Service()` + `inject()`** — root services use the Angular 22 `@Service()`
  decorator and `inject()` (no constructor DI in services).
- **`httpResource`** — PokeAPI data is fetched with `httpResource`: the dex
  list is one static request and the detail is a request **derived from a
  signal** (`selected()`), cached by name so flipping the dex never re-fetches.
  `httpResource.text()` for raw string bodies; a request factory returning
  `undefined` keeps the resource Idle (the cache short-circuit).
- **Pure battle sim** — `battle.simulate(player, rival, rng)` is
  deterministic (rng injected); `MatchRunner` wraps it for the live arena with
  a one-shot `settled` guard (pays out once per match).
- **Reactivity** — zoneless + signal-driven: the 1s ticker updates
  `coins`/`energy`/`collection`/`stats` signals and any template reading them
  re-renders automatically.
- **Testing** — vitest with `describe/it/expect`; signal-driven tests call
  `fixture.detectChanges()` / `await fixture.whenStable()`. Spec pattern in
  `src/app/**/*.spec.ts`.

## Notes

- The app needs the network at runtime (PokeAPI) — there is no local data
  snapshot; sprites come from the PokeAPI CDN.
