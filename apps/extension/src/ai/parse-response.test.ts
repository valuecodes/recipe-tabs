import { describe, expect, it } from "vitest";

import {
  parseIndexedIngredients,
  parseTextIngredients,
} from "~/ai/parse-response";

const answer = (ingredients: unknown[]): string =>
  JSON.stringify({ ingredients });

describe("parseIndexedIngredients", () => {
  it("reads valid items", () => {
    expect(
      parseIndexedIngredients(
        answer([
          { index: 1, name: " milk ", quantity: 2, unit: "dl" },
          { index: 2, name: "salt", unit: " " },
        ]),
        1,
        2
      )
    ).toEqual({
      items: [
        { index: 1, name: "milk", quantity: 2, unit: "dl" },
        { index: 2, name: "salt" },
      ],
    });
  });

  it("turns malformed JSON into a warning", () => {
    const parsed = parseIndexedIngredients("{not json", 1, 3);
    expect(parsed.items).toEqual([]);
    expect(parsed.warning).toMatch(/not valid JSON/);
  });

  it("turns the wrong shape into a warning", () => {
    const parsed = parseIndexedIngredients('{"items": []}', 1, 3);
    expect(parsed.items).toEqual([]);
    expect(parsed.warning).toMatch(/expected shape/);
  });

  it("accepts only the batch's own index range", () => {
    const parsed = parseIndexedIngredients(
      answer([
        { index: 41, name: "flour" },
        { index: 3, name: "from the first batch" },
        { index: 81, name: "past the batch" },
        { index: 42.5, name: "fraction" },
        { index: 41, name: "duplicate" },
      ]),
      41,
      80
    );
    expect(parsed.items).toEqual([{ index: 41, name: "flour" }]);
    expect(parsed.warning).toMatch(/Ignored 4/);
  });

  it("drops empty names and negative quantities", () => {
    const parsed = parseIndexedIngredients(
      answer([
        { index: 1, name: "" },
        { index: 2, name: "sugar", quantity: -1 },
        { index: 3, name: "oil", quantity: "two" },
        "nonsense",
      ]),
      1,
      3
    );
    expect(parsed.items).toEqual([]);
    expect(parsed.warning).toMatch(/Ignored 4/);
  });
});

describe("parseTextIngredients", () => {
  it("reads items with a quoted line", () => {
    expect(
      parseTextIngredients(
        answer([
          { text: "2 dl milk", name: "milk", quantity: 2, unit: "dl" },
          { text: "", name: "nothing" },
        ])
      )
    ).toEqual({
      items: [{ text: "2 dl milk", name: "milk", quantity: 2, unit: "dl" }],
      warning: "Ignored 1 unusable item(s) in the AI's answer",
    });
  });

  it("never throws on garbage", () => {
    expect(parseTextIngredients("").items).toEqual([]);
    expect(parseTextIngredients("null").warning).toMatch(/expected shape/);
  });
});
