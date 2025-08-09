import { State } from "src/state.js";

export function commandHelp(state: State) {
    console.log("Welcome to the Pokedex!");
    console.log("Usage:\n");

    for (const command of Object.values(state.commands)) {
        console.log(`${command.name}: ${command.description}`);
    }
}
