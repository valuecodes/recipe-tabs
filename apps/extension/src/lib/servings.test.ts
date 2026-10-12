import { describe, expect, it } from "vitest";

import { parseServings } from "~/lib/servings";

describe("parseServings", () => {
  it.each([
    ["4 annosta", 4],
    ["Serves 4", 4],
    ["4-6 servings", 4],
    [4, 4],
    [["4", "4 servings"], 4],
    [["many", "6"], 6],
  ])("reads %j as %d", (input, expected) => {
    expect(parseServings(input)).toBe(expected);
  });

  it.each([["a few"], [0], [2.5], [null], [{}], ["0 servings"]])(
    "rejects %j",
    (input) => {
      expect(parseServings(input)).toBeUndefined();
    }
  );
});
