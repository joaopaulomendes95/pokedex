---
title: Product theme — original generated monsters (license-safe launch)
type: product
status: active
date: 2026-08-16
---

# Product theme: original generated monsters

## Problem Frame

The game engine (idle gacha loop: summon portal, prestige, daily challenge,
missions, arena, adventure catch→evolve, save/backend) is complete and
theme-neutral. The current player-facing skin is Pokémon — but the Pokémon IP
(names, sprites, designs, "Poké-" branding) is Nintendo/Game Freak property,
so **the Pokémon version cannot ship publicly** (Palworld-style legal risk).
The project goal is a real, launchable product. We therefore need an original,
license-safe theme that reuses the engine unchanged.

## Product Thesis

A **monster-tamer idle gacha** with a **procedurally generated, fully original
monster catalog** — same engine, original content, zero license risk. The
monster theme keeps the catch → evolve → types → habitats loop the engine was
built around (lowest content-pivot cost), and the Rust generator already
produces the catalog in the backend-contract shape.

## Key Decisions

- **K1. Theme = original generated monsters.** Rejected football (art is hard
  for humanoids; FIFA comparisons) and folklore spirits (more curation) as the
  launch theme; football stays in the back pocket as a future pivot (the
  engine/contract supports it — see docs/backend-catalog.md).
- **K2. Pokémon remains the private dev sandbox.** During development, the app
  keeps using the PokeAPI snapshot (`public/catalog.json`) so mechanics iterate
  on free, familiar data. The launch theme is a **content swap**, not an
  engine rewrite.
- **K3. The monster catalog is generator-driven** (`backend/src/generator.rs`):
  deterministic synthesis — names from syllable affixes, element types by
  stable hash, stats by archetype + element bias, evolution chains (~75%
  linked base→mid→final, ~25% apex), per-element moves, generic abilities,
  flavor templates. No external data, no copied designs (procedural = original
  by construction).
- **K4. The backend contract is the seam.** The frontend already consumes the
  contract shape (`docs/backend-catalog.md`); the swap is: generate the
  original catalog in Rust → serve it → point `PokeData` at the backend (or
  regenerate the local `catalog.json` from the generator output).

## Scope Boundaries

- **Outside this product's identity:** any Pokémon-adjacent designs, names,
  sprites or branding; real licensed players/leagues; paid art.
- **Deferred for later:** full frontend re-theming (copy/UI labels), custom
  artwork pipeline (sprites), the football pivot, player-facing launch
  (accounts/saves wiring is built but the frontend still uses localStorage).

## Success Criteria

- The app runs end-to-end against an **original monster catalog** (no Pokémon
  names/sprites in the shipped build) with every mechanic working: dex,
  adventure catch/evolve, summon portal (rates/pity), arena, missions, daily
  challenge, prestige.
- Catalog regeneration is one command (`node tools/export-catalog.mjs` analog
  in Rust, or `cargo run -- --catalog=<generated>`).
- No external data dependency at runtime for the shipped build.

## Dependencies / Assumptions

- Assumes the procedural generator can produce a catalog varied enough to be
  fun (tunable via pools/archetypes; manual overrides allowed for "hero"
  monsters).
- Assumes placeholder sprites are acceptable pre-launch (generated/CC0 art
  later).

## Open Questions

- Q1 (blocking-ish): When do we flip the sandbox → original theme? (Now, or
  after more mechanic iteration?) — decision deferred to the user.
- Q2: How much lore/identity depth per monster (names only vs short flavor +
  habitat themes)? (Affects generator scope, not engine.)
- Q3: Sprites — procedural pixel-art parts, a CC0 pack (Kenney Monster
  Builder), or manual art for a hero subset first?

## Next Step

Extend `backend/src/generator.rs` into a proper **original monster catalog**
(pool tuning, flavor depth, zone/habitat generation, rarity banding) and
produce a `catalog.json` in the contract shape that the frontend can load —
then decide the flip timing (Q1).
