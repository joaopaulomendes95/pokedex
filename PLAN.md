# PLAN.md - Poké-Liga Idle Improvement Plan

## Overview

Comprehensive fixes for UX, UI, and gameplay issues identified in the Poké-Liga Idle app.

---

## 1. Navbar - Always Visible Sidebar

**Priority**: High  
**Status**: Done  
**Files**: `src/app/app.component.ts`, `src/app/app.component.html`, `src/app/app.component.scss`, `src/app/poke/features/poke-hub/`

**Requirements**:

- Persistent left sidebar navigation (like APP/ reference)
- Always visible, not tab-based
- Contains: Squad, Pokédex, Market, Adventure, Arena, Idle, Save
- Collapsible on mobile
- Active tab indicator

---

## 2. Squad Screen - Card Visual Bugs

**Priority**: High  
**Status**: Done  
**Files**: `src/app/poke/features/squad-builder/squad-builder.component.ts`, `.html`, `.scss`

**Issues**:

- When pokemon added to squad, collection card loses image
- "Bench" button barely visible
- Card styling breaks when `isFielded` changes

**Fix**: Stabilize card rendering, ensure sprite placeholder works, make bench/field button prominent

---

## 3. XP Bar - Size & Float Precision

**Priority**: High  
**Status**: Done  
**Files**: `src/app/poke/features/squad-builder/squad-builder.component.html`, `.scss`, `src/app/poke/game.service.ts`

**Issues**:

- XP bar too thin (6px)
- Shows `411.69999999999624/330 XP` - float precision

**Fix**:

- Increase bar height to 10-12px
- Use `Math.floor()` or `.toFixed(0)` for XP display
- Ensure XP values are integers in game service

---

## 4. Toast Notifications - Top Corner

**Priority**: High  
**Status**: Done  
**Files**: `src/app/poke/notify.service.ts`, `src/app/poke/features/shared/toast/` (new), `styles.scss`

**Requirements**:

- Position: top-right corner
- Stack multiple toasts
- Slide-in animation
- Auto-dismiss after 3-4s
- Click to dismiss

---

## 5. Conditional "Level Up All Ready" Button

**Priority**: High  
**Status**: Done  
**Files**: `src/app/poke/features/squad-builder/squad-builder.component.ts`, `.html`

**Fix**: Only show button when `pendingLevels > 0` for any owned pokemon

---

## 6. Pokédex Global Search

**Priority**: High  
**Status**: Done  
**Files**: `src/app/poke/poke-data.service.ts`, `src/app/poke/features/pokedex/pokedex.component.ts`, `.html`

**Current**: Search only works within current page (limit=30, offset=N)  
**Required**: Search all 1000+ pokemon via PokeAPI `/pokemon?limit=10000` or client-side filter after fetching all names

**Approach**: Fetch full pokemon list once on init, cache names, filter client-side for instant search

---

## 7. Pokédex Icon Sizes

**Priority**: High  
**Status**: Done  
**Files**: `src/app/poke/features/pokedex/pokedex.component.scss`

**Fix**: Increase dex grid cell size from 56px to 80-96px, detail sprite from 240px to 320px

---

## 8. Market - Prices & Energy Drink Logic

**Priority**: High  
**Status**: Done  
**Files**: `src/app/poke/economy.ts`, `src/app/poke/features/market/market.component.ts`, `.html`

**Issues**:

- Prices don't scale sensibly
- Can buy energy drink when energy = 100 (wasted)

**Fix**:

- Price formula: baseStatTotal * levelMultiplier * rarityFactor
- Disable "Use" button for energy drink when `energy >= 100`
- Show "Max Energy" tooltip

---

## 9. Adventure Mode - Missing Zones

**Priority**: High  
**Status**: Partial — catch flow + `noteCatch()` wired; zone coverage re-check pending  
**Files**: `src/app/poke/poke-data.service.ts`, `src/app/poke/features/adventure/`

**Issue**: Some location areas not loading → certain pokemon uncapturable  
**Fix**: Ensure all location areas from PokeAPI are fetched and displayed, fix region/area chain loading

---

## 10. Arena - Infinite Incremental Tournaments

**Priority**: High  
**Status**: Done  
**Files**: `src/app/poke/tournament.ts`, `src/app/poke/game.service.ts`, `src/app/poke/features/arena/`

**Current**: 5 tiers, 3 cups, then stops  
**Required**: Infinite scaling tournaments

- After Champion Cup: "Elite Series 1, 2, 3..."
- Each series: +10% rival levels, +25% coin rewards, +15% XP
- Prestige shards unlock "Master Series" with unique rewards
- Leaderboard / personal best tracking

---

## 11. Arena - Battle UI Stability

**Priority**: High  
**Status**: Done  
**Files**: `src/app/poke/features/arena/arena.component.ts`, `.html`, `.scss`, `src/app/poke/battle.service.ts`

**Issues**:

- UI jumps around during battle
- Hard to read what's happening
- Log scrolls unpredictably

**Fix**:

- Fixed layout positions for player/rival sides
- Battle log: auto-scroll only when user at bottom
- Clear visual separation: HP bars, damage numbers, turn indicator
- Animation: smooth transitions, no layout shifts
- Summary screen: stay visible until user clicks "Next"

---

## 12. Idle - Infinite Incremental Missions

**Priority**: High  
**Status**: Done  
**Files**: `src/app/poke/missions.service.ts`, `src/app/poke/features/quests/`

**Current**: 8 static missions, one-time claim  
**Required**: Mission tiers that scale infinitely

- Tier 1: Current 8 missions
- Tier 2: 2x goals, 3x rewards (unlock after Tier 1 complete)
- Tier 3: 5x goals, 8x rewards
- ...
- Each tier: new mission types (catch specific type, win with specific pokemon, etc.)
- Visual: mission "prestige" badge showing tier

---

## Technical Debt / Cross-Cutting

- [ ] Add error boundaries for PokeAPI failures
- [ ] Offline support (service worker)
- [ ] Mobile responsive testing
- [ ] Performance: virtual scrolling for large lists
- [ ] Accessibility: ARIA labels, keyboard nav

---

## 13. Light/Dark Theme

**Priority**: High  
**Status**: Done  
**Files**: `src/styles.scss`, `src/app/poke/theme.service.ts`, `src/app/layout/navbar/`

**Requirements**:

- Theme model via Material 3 theme config (`using` `mat.theme()`), driving `--mat-sys-*` tokens.
- App-level `ThemeService` with a `theme()` signal (`'light' | 'dark'`), persisted to
  `localStorage` (`poke-league-theme`), defaulting to `prefers-color-scheme`.
- Toggle button in the navbar footer (sun/moon `mat-icon`), cycle light → dark → (auto?).
- Dark variant must cover custom `--color-*` vars (main/green/red/purple/desat tiers) in `styles.scss`.
- No `ZoneProvider`/`NgZone` — keep it zoneless, drive the `class` binding from a signal.

**Implementation**: `html[data-theme='dark']` block in `styles.scss` re-runs `mat.theme()` with
`theme-type: dark` and flips every `--color-*` HSL token (desat/main + green/red/orange/yellow/
purple + shadows). `ThemeService` sets `document.documentElement.dataset.theme`, persists to
`poke-league-theme`, defaults to `prefers-color-scheme`. Navbar footer gets a sun/moon toggle.

---

## 15. APP/ Design-System Migration

**Priority**: High  
**Status**: Done (foundation + screens)  
**Files**: `src/app/shared/ui/*`, `src/styles.scss`, `src/app/poke/features/**`

Bring the game's look-and-feel up to parity with the work repo's `APP/` design system so it doubles
as practice for the job project:

- **Font Awesome** installed (`@fortawesome/fontawesome-free`) as the icon set (chips, KPIs,
  containers, headers all use `fa-solid`); build budgets bumped to fit.
- **Dialogs**: `AppDialogService` (`open` / `openForm` / `showResult` / `openDetails`) + new
  Confirmation / Form / Result dialogs and the slide-in **DetailDialog**
  (`DetailsBlockComponent` + `DetailsSectionsComponent` + `BlockDetailsDataPipe`). Models in
  `src/app/core/models/dialog.interface.ts`.
- **GeneralTileList** port (`src/app/shared/ui/general-tile-list/`) — search / sort / filter /
  paging engine (signal-driven base) with a projected `#tile` template.
- **Screens**: Pokédex rebuilt on `app-general-tile-list` + `app-basic-view` with slide-in
  DetailDialog on tile click; Market, Squad, Save, Arena, Adventure all wrapped in
  `app-basic-view` with the APP page header.
- **Confirmations wired**: prestige (`quests`), full save wipe (`user`), cup entry + forfeit
  (`arena`) now go through `AppDialogService.open()`.
- Shared type→chip color util (`poke-type-color.ts`), `KpiBlock` / `ContainerMark` /
  `CustomChip` used across screens.

---

## 14. PokeAPI-driven Deep-Dives (PokeAPI docs + Orval models)

**Priority**: Medium  
**Status**: Not Started  
**Files**: `src/app/poke/poke-data.service.ts`, `src/app/poke/features/pokedex/`, `src/app/poke/features/market/`, `src/app/poke/features/shared/detail-panel/`, `orval.config.ts`

We already generate PokeAPI models via Orval (`orval.config.ts`) — new resources should consume
the generated types, not raw JSON shapes.

**Ideas (pick and expand):**

- **Type chart codex**: visual type-matchup matrix for the chosen creature (uses existing
  `type-chart.ts`) + `/type/{name}` generated resource; filter Dex by type.
- **Moves preview**: pull the moves array from the creature detail (`/pokemon/{id}` provides the
  move URLs) → rendered in the shared detail panel with damage class + accuracy.
- **Moves detail resource**: Orval resource for `/move/{id}`; cache like the detail cache.
- **Abilities / flavor**: `species` resource → flavor text + genus + capture rate shown in the
  Poké-Card; add `abilities` list.
- **Compare tool** in the Market: side-by-side stat bars of two creatures.
- **Base-stat stars** on the Poké-Card for readability.

## Execution Order (Dependencies)

1. ~~**Navbar** (foundation for all navigation)~~ done
2. ~~**Toast notifications** (used everywhere)~~ done
3. ~~**Squad screen fixes** (core gameplay)~~ done
4. ~~**XP bar fix** (core progression)~~ done
5. ~~**Level Up All button** (uses XP system)~~ done
6. ~~**Pokedex search + icons** (core discovery)~~ done
7. ~~**Market fixes** (economy)~~ done
8. **Adventure zones** — partial, re-check coverage
9. ~~**Arena tournaments + UI** (endgame)~~ done
10. ~~**Idle missions** (retention)~~ done
11. ~~**Light/Dark theme** (cross-cutting; unblocks dark focus in new features)~~ done
12. ~~**APP/ design-system migration** (dialogs + tile lists + basic-view screens + confirmations)~~ done
13. **PokeAPI deep-dives** (codex / moves / abilities / compare)

---

## Notes

- Reference APP/ design system in `/home/joao/personal/projects/dream-xi/APP/src/styles.scss` for sidebar, containers, chips, buttons
- All new components should use `poke/shared/ui/` pattern
- Test after each major change: `npm run build && npx ng test --watch=false`
