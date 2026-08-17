# Poke-Liga Backend (Rust / Axum)

Serves the **catalog contract** defined in [`docs/backend-catalog.md`](../docs/backend-catalog.md) —
the exact data surface the game consumes, so the frontend can point here with
zero changes once `PokeData` is wired to this API.

## Run

```bash
cargo run                       # serves a procedurally-generated ORIGINAL creature set (120)
cargo run -- --catalog=../public/catalog.json   # serves an existing catalog snapshot
```

Then:

```bash
curl localhost:8080/health
curl localhost:8080/catalog                 # whole catalog (contract shape)
curl localhost:8080/catalog/fraxlet         # one creature
curl localhost:8080/moves/ember             # one move
curl localhost:8080/abilities               # all ability texts
curl localhost:8080/zones                   # adventure habitats
```

## Data sources

- **No `--catalog`** → `src/generator.rs` synthesizes a fully original creature
  set at startup: names from syllable affixes, elements/types by stable id
  hash, stats by archetype + element bias, evolution chains (~75% linked in
  base→mid→final groups, ~25% single-stage apex), per-element moves and
  generic abilities. Deterministic — same input, same catalog.
- **`--catalog=path`** → loads an existing snapshot (e.g. the generated
  `public/catalog.json`, 988 creatures) instead.

## Roadmap (when the game moves to this backend)

1. Regenerate the Angular OpenAPI client from this API's spec (the current
   client is Orval-generated — swap `tools/pokeapi.openapi.yml` for this
   backend's OpenAPI).
2. Add player accounts + server-authoritative saves (gacha pulls, economy).
3. Serve your own sprites/artwork (the catalog only carries URLs).

## Contract reminder

The catalog shape (`app`, `version`, `creatures`, `moves`, `abilities`,
`zones`) is what `LocalCatalog` (`src/app/shared/catalog/local-catalog.ts`)
already loads from `public/catalog.json` — the frontend is already consuming
this exact JSON offline.

## Original launch-theme catalog

```bash
cargo run -- --emit-catalog=out/original-catalog.json
```

Dumps the generated ORIGINAL monster catalog (license-safe) to a
contract-shape JSON file the frontend's `LocalCatalog` can load. The set:
120 monsters across a rarity pyramid (45/30/15/8/2 → common…legendary),
~75% with base→mid→final evolution chains, occasional dual types, 8 element
habitats. See `docs/brainstorms/2026-08-16-product-theme-original-monsters-requirements.md`.
