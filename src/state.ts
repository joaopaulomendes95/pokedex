import { commandHelp } from "./commands/help.js";
import { commandExit } from "./commands/exit.js";
import { createInterface, type Interface } from "readline";

export type CLICommand = {
  name: string;
  description: string;
  callback: (state: State) => void;
};

export type State = {
    rl: Interface;
    commands: Record<string, CLICommand>;
};

export function initState(): State {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "Pokedex > "
    });

    const commands: Record<string, CLICommand> = {
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

    return { rl, commands };
};
