import { describe, expect, test } from "vitest";
import { cleanInput } from "./utils/clean_input";
describe.each([
    {
        input: "  hello  world  ",
        expected: ["hello", "world"],
    },
    {
        input: "  hello  world  ",
        expected: ["hello", "world"],
    },
    {
        input: "  what  the hell is going on?  ",
        expected: ["what", "the", "hell", "is", "going", "on?"],
    },
    {
        input: "  He's long gone ",
        expected: ["he's", "long", "gone"],
    },
    {
        input: "  It's your opinion  ",
        expected: ["it's", "your", "opinion"],
    },
    {
        input: "  this testing thing is lame... ",
        expected: ["this", "testing", "thing", "is", "lame..."],
    },
    // TODO: more test cases here
])("cleanInput($input)", ({ input, expected }) => {
    test(`Expected: ${expected}`, () => {
        const actual = cleanInput(input);
        // The `expect` and `toHaveLength` functions are from vitest
        // they will fail the test if the condition is not met
        expect(actual).toHaveLength(expected.length);
        for (const i in expected) {
            // likewise, the `toBe` function will fail the test if the values are not equal
            expect(actual[i]).toBe(expected[i]);
        }
    });
});
