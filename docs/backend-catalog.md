# Backend Catalog Contract — freeing the game from PokeAPI

**Goal:** define exactly what the game consumes from PokeAPI today, the JSON
schema any future backend (Rust/Go/TS) must serve to replace it **with zero
frontend changes**, and the generation algorithm for an original creature set.

---

## 1. What the frontend actually needs

The game talks to PokeAPI through `PokeData` (`src/app/poke/poke-data.ts`).
Every lookup it performs maps to one of these endpoints — a future backend only
needs to serve this surface:

| Frontend use | PokeAPI today | Replace with |
|---|---|---|
| Dex pages + search + summon pool (`masterList`) | `GET /pokemon?limit=N&offset=0` (list of `{name, url}`) | `GET /catalog` → full list |
| Detail: types/stats/base XP/moves/abilities/sprites (`pokeByName`, `detail()`) | `GET /pokemon/:name` | `GET /creatures/:name` |
| Flavor text + evolves-from + chain id (`speciesFlavor`, `evolvesFrom`) | `GET /pokemon-species/:name` | part of `/creatures/:name` |
| Evolution chain (`evolutionFor`) | `GET /evolution-chain/:id` | `GET /creatures/:name/evolution` |
| Real moves: type/category/power (`moveByName`, `movesFor`) | `GET /move/:name` | `GET /moves/:name` |
| Ability effect text (`abilityEffect`) | `GET /ability/:name` | `GET /abilities/:name` |
| Adventure wild pools (`zonePool`, area encounters) | `GET /location-area/:id` | `GET /zones/:id` |
| Sprites | external CDN URLs (`raw.githubusercontent.com/...`) | own sprite URLs in the catalog |

> The current app uses Orval-generated clients from `tools/pokeapi.openapi.yml`.
> A new backend only needs to emit an OpenAPI spec with this surface and
> regenerate `src/app/shared/openapi/` — no component changes.

## 2. The catalog JSON schema (single snapshot file)

One file with everything the runtime needs (this is what the snapshot tool
generates and what the Rust backend can stream):

```jsonc
{
  "app": "poke-liga-catalog",
  "version": 1,
  "generatedAt": "2026-08-16T00:00:00Z",
  "maxGen": 9,
  "creatures": {
    "fraxlet": {
      "id": 1,
      "name": "fraxlet",
      "types": ["fire"],
      "stats": { "hp": 45, "attack": 60, "defense": 40, "spAtk": 55, "spDef": 45, "speed": 65 },
      "baseExperience": 62,
      "spriteUrl": "https://cdn.example.com/sprites/fraxlet.png",
      "artworkUrl": "https://cdn.example.com/art/fraxlet.png",
      "moves": [
        { "name": "ember", "level": 1 },
        { "name": "flame-charge", "level": 12 }
      ],
      "abilities": [{ "name": "blaze", "isHidden": false }],
      "flavor": "A small ember spirit that ignites dry grass.",
      "evolvesFrom": null,
      "evolvesTo": [{ "species": "fraxburn", "trigger": "level 16" }]
    }
  },
  "moves": {
    "ember": { "name": "ember", "type": "fire", "category": "special", "power": 40 }
  },
  "abilities": {
    "blaze": "Powers up Fire-type moves when the creature is in trouble."
  },
  "zones": {
    "https://api.example.com/zones/kanto/route-1": {
      "name": "route-1",
      "encounters": ["fraxlet", "spriglet", "bramblet"]
    }
  }
}
```

**Key decisions:**
- `evolvesFrom`/`evolvesTo` are **denormalized into the creature** (no chain
  fetches — one less request and one less failure mode).
- `moves` on a creature are `{name, level}` refs; the move's type/category/power
  lives in `moves` (shared — a move has fixed stats).
- Sprite URLs are absolute (served by the backend/CDN), so the frontend keeps
  using `<img src>` unchanged.
- `zones` keep the same URL-as-key shape `PokeLocation` already uses, so the
  adventure region map (`adventure-regions.ts`) works untouched.

## 3. Generation algorithm (for the original creature set)

Rust backend bootstrap that produces `creatures`, `moves`, `abilities` with no
external data:

1. **Moves**: hand-curate ~60 moves: `{name, type, category, power}` with
   predictable power bands (40/55/75/95/120 by type-color).
2. **Abilities**: ~20 generic effect texts with deterministic values.
3. **Creatures**: for target count N and maxGen G:
   - `id` 1..N (gen = 1 + floor((id-1) / (N/G))).
   - **name** = 2-syllable combiner from curated affixes
     (e.g. `["fra","spri","bram","vol","glim","kelp"] × ["x","let","burn","tide"]`)
     + collision retry + manual overrides for the "hero" creatures.
   - **types**: 1-2 elements drawn by a stable hash of `id`.
   - **stats**: archetype spreads (balanced / tank / sweeper / fast) × element
     bias (fire→atk, water→hp, rock→def, …), with ±10% hash jitter.
   - **baseExperience** = round(stat total / 3) → drives the rarity bands the
     frontend already uses (`rarityFor`).
   - **evolution**: 70% of species get `evolvesTo: [level 16/32…]` chains;
     the rest are apex (+8% bonus the frontend already applies).
   - **moves**: 6-8 moves by level from the move table filtered by type.
   - **sprites**: procedural pixel-art parts (body/head/eyes by type+id hash)
     or a CC0 pack (Kenney Monster Builder).
4. **Deterministic**: same input → same catalog, so tests/balance stay stable.

## 4. Swap strategy (zero frontend change)

- Generate `catalog.json` via `tools/export-catalog.ts` (snapshot from PokeAPI
  for now — same data, no runtime dependency).
- `LocalCatalog` (`src/app/shared/catalog/`) loads it and **seeds the same
  in-memory caches** `PokeData` already uses → the network resources
  short-circuit (everything "already cached").
- Later: point `PokeData` at your Rust API (same shape) and delete the remote
  resources. The frontend diff is one constructor + the client regeneration.

## 5. Risks & notes

- Snapshot size: 1025 creatures ≈ 3-6 MB JSON — fine as an asset, loaded in the
  background at boot; the app keeps working while it loads.
- The adventure zones snapshot covers only the 13 curated regions (52 areas).
- `GAME_CONFIG`/balance constants are already frontend-side and unaffected.
