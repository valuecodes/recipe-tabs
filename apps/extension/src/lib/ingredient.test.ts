import { describe, expect, it } from "vitest";

import { parseIngredientLine } from "~/lib/ingredient";

// All lines are invented.
describe("parseIngredientLine", () => {
  it.each([
    ["2 dl maitoa", { quantity: 2, unit: "dl", name: "maitoa" }],
    ["1,5 kg jauhelihaa", { quantity: 1.5, unit: "kg", name: "jauhelihaa" }],
    ["1/2 tl suolaa", { quantity: 0.5, unit: "tl", name: "suolaa" }],
    ["½ cup sugar", { quantity: 0.5, unit: "cup", name: "sugar" }],
    ["1 1/2 tbsp oil", { quantity: 1.5, unit: "tbsp", name: "oil" }],
    ["1½ dl kermaa", { quantity: 1.5, unit: "dl", name: "kermaa" }],
    ["2-3 tbsp water", { quantity: 2, unit: "tbsp", name: "water" }],
    ["2–3 rkl vettä", { quantity: 2, unit: "rkl", name: "vettä" }],
    ["200 g butter", { quantity: 200, unit: "g", name: "butter" }],
    ["2 cups flour", { quantity: 2, unit: "cup", name: "flour" }],
    ["1 prk kermaa", { quantity: 1, unit: "prk", name: "kermaa" }],
    ["3 eggs", { quantity: 3, name: "eggs" }],
    ["2 large onions", { quantity: 2, name: "large onions" }],
    ["1 constructor", { quantity: 1, name: "constructor" }],
    ["salt", { name: "salt" }],
    ["  pepper  ", { name: "pepper" }],
  ])("%s", (line, expected) => {
    expect(parseIngredientLine(line)).toEqual(expected);
  });
});
