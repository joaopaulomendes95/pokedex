/** Gerações Pokémon baseadas no ID do Pokédex nacional (PokeAPI). */
export const GENERATION_RANGES: { gen: number; start: number; end: number }[] = [
  { gen: 1, start: 1, end: 151 },
  { gen: 2, start: 152, end: 251 },
  { gen: 3, start: 252, end: 386 },
  { gen: 4, start: 387, end: 493 },
  { gen: 5, start: 494, end: 649 },
  { gen: 6, start: 650, end: 721 },
  { gen: 7, start: 722, end: 809 },
  { gen: 8, start: 810, end: 905 },
  { gen: 9, start: 906, end: 1025 },
];

/** Devolve a geração (1–9) para um dado Pokédex ID. */
export function generationFromId(id: number): number {
  const found = GENERATION_RANGES.find((r) => id >= r.start && id <= r.end);
  return found?.gen ?? 9;
}

/** Devolve o máximo ID permitido para uma geração (inclusive). */
export function maxIdForGen(gen: number): number {
  return GENERATION_RANGES.find((r) => r.gen === gen)?.end ?? 1025;
}

/** Filtra uma lista de PokeId (com url contendo o ID) pelo maxGen. */
export function filterByGeneration<T extends { url: string }>(list: T[], maxGen: number): T[] {
  const maxId = maxIdForGen(maxGen);
  return list.filter((item) => {
    const id = Number(item.url.match(/\/(\d+)\/?$/)?.[1] ?? '0');
    return id <= maxId;
  });
}
