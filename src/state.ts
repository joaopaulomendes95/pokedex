import { commandHelp } from "./commands/help.js";
import { commandExit } from "./commands/exit.js";
import { createInterface, type Interface } from "readline";
import { PokeAPI } from "./pokeapi.js";
import { map } from "./commands/map.js";
import { mapb } from "./commands/mapb.js";

export type CLICommand = {
  name: string;
  description: string;
  callback: (state: State) => Promise<void>;
};

export type State = {
    rl: Interface;
    commands: Record<string, CLICommand>;
    pokeapi: PokeAPI;
    nextLocationsURL: string | null;
    prevLocationsURL: string | null;
};

export function initState(): State {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "Pokedex > "
    });

    const commands: Record<string, CLICommand> = {
        map: {
            name: "map",
            description: "Displays the name of 20 locations",
            callback: map,
        },
        mapb: {
            name: "map",
            description: "Displays the name of the previous 20 locations",
            callback: mapb,
        },
        help: {
            name: "help",
            description: "Displays a help message",
            callback: commandHelp,
        },
        exit: {
            name: "exit",
            description: "Exits the pokedex",
            callback: commandExit,
        },
        // can add more commands here
    };

    return {
        rl,
        commands,
        pokeapi: new PokeAPI(),
        nextLocationsURL: null,
        prevLocationsURL: null
    };
};
