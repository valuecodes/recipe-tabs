import { describe, expect, it } from "vitest";

import { findIngredientWindow, normalizeForMatch } from "~/lib/text-recipe";

// All page text is invented.
describe("findIngredientWindow", () => {
  it("starts at a Finnish heading", () => {
    const text = "Intro text\nAinekset\n2 dl maitoa\n1 muna";
    expect(findIngredientWindow(text)).toEqual({
      text: "Ainekset\n2 dl maitoa\n1 muna",
      foundHeading: true,
    });
  });

  it("matches an English heading with a colon, case-insensitively", () => {
    const text = "Story\n  INGREDIENTS:  \n200 g flour";
    const window = findIngredientWindow(text);
    expect(window.foundHeading).toBe(true);
    expect(window.text.trim().startsWith("INGREDIENTS:")).toBe(true);
  });

  it("does not take a heading word inside a sentence", () => {
    const window = findIngredientWindow("The ingredients are simple.\n1 egg");
    expect(window.foundHeading).toBe(false);
  });

  it("respects the window size", () => {
    const text = `Ingredients\n${"x".repeat(100)}`;
    expect(findIngredientWindow(text, 20).text).toHaveLength(20);
  });

  it("falls back to the start of the text without a heading", () => {
    expect(findIngredientWindow("abcdef", 3)).toEqual({
      text: "abc",
      foundHeading: false,
    });
  });

  it("handles empty text", () => {
    expect(findIngredientWindow("")).toEqual({
      text: "",
      foundHeading: false,
    });
  });
});

describe("normalizeForMatch", () => {
  it("lower-cases and collapses whitespace", () => {
    expect(normalizeForMatch("  2 DL\n  Milk ")).toBe("2 dl milk");
  });
});
