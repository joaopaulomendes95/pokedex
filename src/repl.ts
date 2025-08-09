import { createInterface } from "readline";
import { cleanInput } from "./utils/clean_input.js";
import { commandExit } from "./commands/exit.js";
import { getCommands } from "./commands/get_commands.js";

export function startREPL() {
    const commands = getCommands();
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "Pokedex > "
    });

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
            command.callback(commands);
        } else {
            console.log("Unknown command");
        }

        rl.prompt();
    });
}
