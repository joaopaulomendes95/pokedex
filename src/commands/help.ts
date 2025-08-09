import type { State } from "../state.js";

export async function commandHelp(state: State) {
    console.log();
    console.log("Welcome to the Pokedex!");
    console.log("Usage:");
    console.log();

    for (const command of Object.values(state.commands)) {
        console.log(`${command.name}: ${command.description}`);
    }

    console.log();
}
