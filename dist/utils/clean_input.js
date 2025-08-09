export function cleanInput(input) {
    return input
        .trim()
        .toLowerCase()
        .split(/\s+/);
}
