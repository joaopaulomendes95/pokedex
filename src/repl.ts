import { createInterface } from "readline";
import { cleanInput } from "./utils/clean_input.js";
import { commandExit } from "./commands/exit.js";
// import { getCommands } from "./commands/get_commands.js";
import { type State } from "./state.js";

export function startREPL(state: State) {
    const rl = state.rl;
    const commands = state.commands;

    rl.prompt();

    rl.on("line", (line) => {
        const cleanedInput = cleanInput(line);

        if (cleanInput.length === 0) {
            console.log("No input provided.");
            rl.prompt();
            return;
        }

        const commandName = cleanedInput[0];
        const command = commands[commandName];

        if (command) {
            command.callback(state);
        } else {
            console.log("Unknown command");
        }

        rl.prompt();
    });
}
