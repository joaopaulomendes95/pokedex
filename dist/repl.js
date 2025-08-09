import { createInterface } from "readline";
import { cleanInput } from "./utils/clean_input.js";
export function startREPL() {
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
        console.log(`Your command was: ${cleanedInput[0]}`);
        rl.prompt();
    });
}
