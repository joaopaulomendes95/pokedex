export class PokeAPI {
  private static readonly baseURL = "https://pokeapi.co/api/v2";

  constructor() {}

  async fetchLocations(pageURL?: string): Promise<ShallowLocations> {
    const url = pageURL || `${PokeAPI.baseURL}/location-area?limit=20`;
    try {
        const response = await fetch (url);
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        return await response.json();
    } catch (err) {
        console.log(err);
        throw err;
    }
  }

  async fetchLocation(locationName: string): Promise<Location> {
    const url = locationName || `${PokeAPI.baseURL}/location-area?${locationName}`;
    try {
        const response = await fetch (url);
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        return await response.json();
    } catch (err) {
        console.log(err);
        throw err;
    }
  }
}

export type ShallowLocations = {
    count: number;
    next: string | null;
    previous: string | null;
    results: {
        name: string;
        url: string;
    }[];
};

export type Location = {
    id: number;
    name: string;
    // TODO: more if needed
};
