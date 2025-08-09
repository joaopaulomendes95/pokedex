import { State } from "../state";

export async function mapb(state: State): Promise<void> {
    if (!state.prevLocationsURL) {
        console.log("You're on the first page");
        return;
    }

    try {
        const locations = await state.pokeapi.fetchLocations(state.prevLocationsURL);

        locations.results.forEach(loc => console.log(loc.name));

        state.nextLocationsURL = locations.next;
        state.prevLocationsURL = locations.previous;

    } catch (err) {
        console.log(err);
        throw err;
    }
}
