import { State } from "../state";

export async function map(state: State): Promise<void> {
    try {
        const locations = await state.pokeapi.fetchLocations(state.nextLocationsURL ?? undefined);

        locations.results.forEach(loc => console.log(loc.name));

        state.nextLocationsURL = locations.next;
        state.prevLocationsURL = locations.previous;
    } catch (err) {
        console.log(err);
        throw err;
    }
}
