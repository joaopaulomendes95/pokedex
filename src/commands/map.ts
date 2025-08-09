import type { State } from "../state.js";

export async function commandMapForward(state: State) {
    const locations = await state.pokeApi.fetchLocations(state.nextLocationsURL);

    state.nextLocationsURL = locations.next;
    state.prevLocationsURL = locations.previous;

    for (const loc of locations.results) {
        console.log(loc.name);
    }
}

export async function commandMapBack(state: State) {
    if (!state.prevLocationsURL) {
        throw new Error("You're on the first page");
    }

    const locations = await state.pokeApi.fetchLocations(state.prevLocationsURL);

    state.nextLocationsURL = locations.next;
    state.prevLocationsURL = locations.previous;

    for (const loc of locations.results) {
        console.log(loc.name);
    }
}