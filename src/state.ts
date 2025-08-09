import { createInterface, type Interface } from "readline";
import { getCommands } from "./commands/commands.js";
import { PokeAPI } from "./pokeapi.js";

export type CLICommand = {
  name: string;
  description: string;
  callback: (state: State, ...args: string[]) => Promise<void>;
};

export type State = {
    readline: Interface;
    commands: Record<string, CLICommand>;
    pokeApi: PokeAPI;
    nextLocationsURL: string;
    prevLocationsURL: string;
};

export function initState(cacheInterval: number) {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "pokedex > "
    });

    return {
        readline: rl,
        commands: getCommands(),
        pokeApi: new PokeAPI(cacheInterval),
        nextLocationsURL: "",
        prevLocationsURL: "",
    };
}
