import { defineConfig } from 'orval';

/**
 * Poké-Liga Idle fetches its 1:1 data contract from PokeAPI's official OpenAPI
 * spec (vendored at ./tools/pokeapi.openapi.yml). Orval generates native
 * signal-first `httpResource` functions (client: 'angular', retrievalClient:
 * 'httpResource') — no axios, no service classes; every endpoint becomes a
 * `*Resource(nameOrId, params)` that returns an `HttpResourceRef`.
 *
 * Regenerate with: npx orval
 */
export default defineConfig({
  pokeapi: {
    input: {
      target: './tools/pokeapi.openapi.yml',
    },
    output: {
      mode: 'tags-split',
      target: 'src/app/shared/openapi/poke-api',
      schemas: 'src/app/shared/openapi/poke-api/model',
      client: 'angular',
      baseUrl: 'https://pokeapi.co',
      clean: true,
      override: {
        angular: {
          retrievalClient: 'httpResource',
        },
      },
    },
  },
});
