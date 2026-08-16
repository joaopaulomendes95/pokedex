---
title: feat: idle-engine depth pass — upgrades, star ascension, cup rules, mastery
type: feat
status: complete
date: 2026-08-15
---

# Idle-engine depth pass — upgrades, star ascension, cup rules, mastery

## Overview

Four engine-level mechanics (theme-agnostic — they survive the planned backend/skin swap) that close the classic idle loop: a permanent coin sink (upgrade shop), duplicate→star ascension, rule-modified cup challenges, and per-species mastery.

## Problem Frame

Coins pile up with no long-term sink; duplicate catches only convert to coins; tournaments all play by the same rules; and there is no per-action "grind with visible progress". These four mechanics address those gaps while reusing existing patterns (root `@Service()` + signals + `BrowserStorage`, Notify toasts, the Idle hub page, spec-per-service tests).

## Requirements Trace

- R1. Spend coins on permanent upgrades (income, passive XP, energy cap/regen, catch bonus, offline cap) that survive prestige.
- R2. Duplicate catches ascend the owned species (stars) with a stat bonus; maxed species convert to coins as today.
- R3. Some tournaments carry rules (squad size cap, level cap, generation lock) with scaled rewards; rules are visible before entering.
- R4. Species mastery: earned from battle/idle XP, boosts that species' XP gain and income; visible in the Idle hub and full details.

## Scope Boundaries

- No new backend, no persistence changes beyond localStorage keys.
- The pure battle sim (`src/app/poke/battle.ts`) stays untouched — star bonuses apply at fighter build time, mastery applies at XP-grant time.
- No new tabs: upgrades live in the existing Shop dialog; mastery + star display reuse the Idle hub / squad / full-details surfaces.

## Context & Research

### Relevant Code and Patterns

- Root services + signals + storage: `src/app/poke/missions.ts`, `src/app/poke/achievements.ts`, `src/app/poke/daily-reward.ts`
- Shop modal (single buy+use surface): `src/app/poke/features/shared/shop-dialog/`
- Battle fighter build: `src/app/poke/battle.ts` (`buildFighter`), spawn: `src/app/poke/match.runner.ts`
- Cups: `src/app/poke/tournament.ts`, run flow: `src/app/poke/features/arena/arena.ts`
- Idle hub sections: `src/app/poke/features/quests/`
- Spec conventions: `src/app/poke/*.spec.ts`, `src/app/core/services/save-io/save-io.spec.ts`

### Institutional Learnings

- `docs/solutions/` does not exist yet; no relevant entries.

### External References

- None needed — local patterns are strong and recently touched (skip external research).

## Key Technical Decisions

- **No circular DI**: `Upgrades`/`Mastery` inject only `BrowserStorage` (and no services); `Game` injects them one-way. Purchases live in the Shop dialog (spend coins via `Game`, level up via `Upgrades`).
- **Sim purity**: star multipliers apply in `buildFighter`/`levelScale` (add an optional stars param) and UI scaled-stats; mastery multiplies XP at `Game.grantXp`/tick time, never inside `resolveExchange`.
- **Backward-compatible saves**: `OwnedPoke.stars` optional (undefined = 0); new storage keys default when absent.
- **Cup rules are optional fields on `Cup`**; applied only when spawning the player side in cup battles.

## Implementation Units

- [x] U1. **Upgrade shop (coin sink)**
- [x] U2. **Duplicate → star ascension**
- [x] U3. **Rule-modified cups (challenges)**
- [x] U4. **Species mastery**

---

- [x] U1. **[Upgrade shop (coin sink)]**

**Goal:** A permanent coin sink with levelable upgrades that boost income, passive XP, energy cap/regen, catch chance and offline cap — surviving prestige.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Create: `src/app/poke/upgrades.ts`, `src/app/poke/upgrades.spec.ts`
- Modify: `src/app/poke/game.ts` (apply multipliers/caps), `src/app/poke/features/shared/shop-dialog/shop-dialog.ts`, `shop-dialog.component.html`, `shop-dialog.component.scss`
- Test: `src/app/poke/upgrades.spec.ts`, `src/app/poke/game.service.spec.ts` (income/energy with upgrade levels)

**Approach:**
- `Upgrades` service: catalog (`id`, `name`, `desc`, `icon`, `maxLevel`, `baseCost`, `costMult`, `perLevel`), persisted `{ id: level }` under `poke-league-upgrades`. Computed `multiplier(id)` and `capAdd(id)`; `cost(id)`; `levelUp(id)`.
- `Game` injects `Upgrades`; `incomePerSec`/`passiveXpPerSec` multiply by upgrade bonuses; `energyMax()` computed replaces the hardcoded `100` in templates; tick regen and `restoreOffline` cap include upgrades.
- Shop dialog gets an "Upgrades" section listing level, effect, cost, buy button (spend + levelUp).

**Test scenarios:**
- Happy: leveling an upgrade raises its multiplier and the persisted level.
- Happy: `Game.incomePerSec()` reflects the income upgrade; energy cap reflects the cap upgrade.
- Edge: cost growth per level; max-level button disabled.
- Error: purchase fails (not enough coins) without changing the level.
- Integration: buying in the shop dialog calls spend + levelUp.

**Verification:** `npm test`, `npm run lint`, `npm run build` green; upgrades appear in the Shop modal and affect income/energy live.

---

- [x] U2. **[Duplicate → star ascension]**

**Goal:** Duplicate catches ascend the owned species (up to 5 stars, +8% stats each); maxed duplicates still convert to coins.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `src/app/poke/game.ts` (`addStar`, star-aware save), `src/app/poke/poke.model.ts` (`OwnedPoke.stars`), `src/app/poke/battle.ts` (`buildFighter` stars param), `src/app/poke/match.runner.ts` (spawn with stars), `src/app/poke/features/adventure/adventure.ts` (duplicate branch), `src/app/poke/features/squad-builder/squad-builder.ts` + `.html` + `.scss` (star badges, scaled stats), `src/app/poke/features/shared/poke-full-details/*` (stars + scaled stats)
- Test: `src/app/poke/game.service.spec.ts` (addStar cap/back-compat), `src/app/poke/features/adventure/adventure.spec.ts` if cheap

**Approach:**
- `OwnedPoke.stars?: number`; `Game.addStar(name)` caps at 5 and persists.
- `levelScale` consumers multiply by `(1 + 0.08 * stars)`; `buildFighter` gains an optional stars arg; `MatchRunner.spawn` reads stars from owned entries.
- Adventure duplicate catch: owned stars < 5 → `addStar` + message; else current coins path.

**Test scenarios:**
- Happy: catching a duplicate of an owned species increments stars (and a maxed species pays coins instead).
- Edge: stars cap at 5; old saves without `stars` behave as 0.
- Integration: a fielded 3-star pokémon's fighter stats are higher than the same pokémon with 0 stars.

**Verification:** star badges on squad cards/full details; catch flow ascends stars.

---

- [x] U3. **[Rule-modified cups (challenges)]**

**Goal:** Cups with visible rules (squad size cap, level cap, generation lock) and scaled rewards; rules applied to the player side in cup battles.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `src/app/poke/tournament.ts` (rule fields + 2-3 new rule cups), `src/app/poke/features/arena/arena.ts` (apply rules when spawning the player team), `src/app/poke/features/arena/arena.component.html` + `.scss` (rule chips on cup cards / run panel)
- Test: `src/app/poke/tournament.spec.ts` (rule cup definitions + reward scaling), `src/app/poke/features/arena/arena.spec.ts` if practical

**Approach:**
- `Cup.rules?: CupRule[]` with `{ id: 'squadSize' | 'levelCap' | 'genOnly', value }`.
- New base cups: Mini Cup (squad size 3), Veteran Cup (level cap 30), Retro Cup (gen 1 only) with scaled entry/prizes.
- On `nextCupBattle`, filter the player squad by rules (gen via master list, size), clamp fighter levels via a level cap at spawn; rules shown as chips on cards and in the active run.

**Test scenarios:**
- Happy: a squadSize-3 cup fields at most 3 fighters.
- Happy: a levelCap cup clamps spawned levels; genOnly filters out-of-gen squad members.
- Edge: empty squad after filtering → entry blocked with a message.
- Integration: rules chips render on cup cards; entering a rule cup starts the run.

**Verification:** rule cups appear, enforce their rules in battle, and show chips.

---

- [x] U4. **[Species mastery]**

**Goal:** Per-species mastery earned from battle/idle XP that boosts that species' XP gain and income; visible in the Idle hub and full details.

**Requirements:** R4

**Dependencies:** None (independent of U1-U3)

**Files:**
- Create: `src/app/poke/mastery.ts`, `src/app/poke/mastery.spec.ts`
- Modify: `src/app/poke/game.ts` (grant XP scaled by mastery; feed mastery from XP), `src/app/poke/features/quests/quests.ts` + `.html` + `.scss` (mastery section), `src/app/poke/features/shared/poke-full-details/*` (species mastery line)
- Test: `src/app/poke/mastery.spec.ts`, `src/app/poke/game.service.spec.ts` (XP scaling)

**Approach:**
- `Mastery` service: `{ species: xp }` persisted under `poke-league-mastery`; pure `masteryLevel(xp)` (triangular thresholds, cap 10); `bonus(level)` = +3% XP and +1% income per level.
- `Game.grantXp(name, amount)`: grants `amount * bonus` and feeds `amount * 0.15` into mastery for that species; passive tick does the same per owned species.
- Idle hub shows the top mastered species with level/XP; full details shows the current species' mastery line.

**Test scenarios:**
- Happy: earning XP raises species mastery and the level curve matches thresholds.
- Happy: `grantXp` pays scaled XP once mastery levels exist.
- Edge: unknown species gains no mastery; level caps at 10.
- Integration: mastery XP increases when a battle grants XP.

**Verification:** mastery levels appear in the Idle hub and full details; XP scaling is visible.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Circular DI (Game ↔ Upgrades/Mastery) | Upgrades/Mastery never inject Game; purchases live in UI components |
| Balance numbers feel arbitrary | Central constants with per-level multipliers; easy to tune |
| Old saves without new fields | All new fields optional with defaults |
| SCSS budgets (6 kB warn / 8 kB error) | New UI styles kept compact; overflow to global partials like `_arena-extra.scss` if needed |

## Documentation / Operational Notes

- Update `AGENTS.md` bullets for the four new services once implemented.

## Sources & References

- Related code: `src/app/poke/missions.ts` (service pattern), `src/app/poke/tournament.ts` (cups), `src/app/poke/features/shared/shop-dialog/` (buy surface)
