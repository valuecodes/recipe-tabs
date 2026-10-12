import { describe, expect, it } from "vitest";

import { fromSchemaNutrition, parseAmount } from "~/lib/nutrition";

// Built from its code point so no invisible character sits in the source.
const NO_BREAK_SPACE = String.fromCodePoint(0xa0);

describe("parseAmount", () => {
  it.each([
    ["412 kcal", { value: 412, unit: "kcal" }],
    ["12,5 g", { value: 12.5, unit: "g" }],
    ["1 234 kcal", { value: 1234, unit: "kcal" }],
    [`1${NO_BREAK_SPACE}234 kJ`, { value: 1234, unit: "kj" }],
    ["7", { value: 7 }],
    [7, { value: 7 }],
  ])("parses %j", (input, expected) => {
    expect(parseAmount(input)).toEqual(expected);
  });

  it.each([
    ["-3 g"],
    ["n/a"],
    ["1/2 g"],
    ["12 g sugar"],
    ["1.5.2 g"],
    [-1],
    [Number.NaN],
    [null],
  ])("rejects %j", (input) => {
    expect(parseAmount(input)).toBeUndefined();
  });
});

describe("fromSchemaNutrition", () => {
  it("is per serving only when servingSize names a serving", () => {
    for (const servingSize of [
      "1 annos",
      "1 serving",
      "Per portion",
      "Ravintoarvot annoksessa",
    ]) {
      expect(
        fromSchemaNutrition({ servingSize, calories: "412 kcal" })?.kcal
      ).toEqual({ value: 412, basis: "per-serving", source: "site" });
    }
  });

  it("is unknown basis for 100 g or no servingSize", () => {
    expect(
      fromSchemaNutrition({ servingSize: "100 g", calories: "200" })?.kcal
        ?.basis
    ).toBe("unknown");
    expect(fromSchemaNutrition({ fatContent: "3 g" })?.fatG?.basis).toBe(
      "unknown"
    );
  });

  it("converts kJ and mg, and drops unknown units", () => {
    expect(
      fromSchemaNutrition({
        calories: "1700 kJ",
        sugarContent: "1500 mg",
        fatContent: "12 oz",
      })
    ).toEqual({
      kcal: { value: 406, basis: "unknown", source: "site" },
      sugarG: { value: 1.5, basis: "unknown", source: "site" },
    });
  });

  it("returns undefined when nothing survives", () => {
    expect(fromSchemaNutrition({ fatContent: "12 oz" })).toBeUndefined();
    expect(fromSchemaNutrition("412 kcal")).toBeUndefined();
    expect(fromSchemaNutrition(undefined)).toBeUndefined();
  });
});
