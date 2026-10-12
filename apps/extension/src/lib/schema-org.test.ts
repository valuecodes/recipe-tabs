import { describe, expect, it } from "vitest";

import { cleanText, findRecipeNode, readRecipeNode } from "~/lib/schema-org";
import {
  englishMainEntity,
  finnishGraph,
  noRecipe,
} from "~/test/fixtures/json-ld";

const read = (jsonLd: unknown[]) => {
  const node = findRecipeNode(jsonLd);
  return node === undefined ? undefined : readRecipeNode(node);
};

describe("findRecipeNode + readRecipeNode", () => {
  it("reads a Recipe inside @graph with an @type array and sections", () => {
    expect(read([finnishGraph])).toEqual({
      title: "Mansikka & vanilja panna cotta",
      language: "fi-fi",
      servings: 4,
      ingredients: ["4 dl kermaa", "1 dl sokeria", "3 liivatelehteä"],
      instructions: ["Liota liivatteet.", "Kuumenna kerma.", "Soseuta marjat."],
      nutrition: {
        kcal: { value: 412, basis: "per-serving", source: "site" },
        sugarG: { value: 12.5, basis: "per-serving", source: "site" },
        fatG: { value: 30, basis: "per-serving", source: "site" },
      },
    });
  });

  it("reads a Recipe under mainEntity with string instructions", () => {
    expect(read([noRecipe, englishMainEntity])).toEqual({
      title: "Weekday Waffles",
      servings: 8,
      ingredients: ["2 cups flour", "2 eggs"],
      instructions: ["Mix everything.", "Cook in a hot iron."],
    });
  });

  it("finds a Recipe in a top-level array", () => {
    expect(findRecipeNode([[{ "@type": "Recipe", name: "Soup" }]])?.name).toBe(
      "Soup"
    );
  });

  it("splits a newline-separated ingredient string", () => {
    const node = findRecipeNode([
      { "@type": "Recipe", recipeIngredient: "1 egg\n\n2 dl milk\r\n" },
    ]);
    expect(node === undefined ? [] : readRecipeNode(node).ingredients).toEqual([
      "1 egg",
      "2 dl milk",
    ]);
  });

  it("returns undefined when there is no Recipe", () => {
    expect(findRecipeNode([noRecipe, "text", null, 4])).toBeUndefined();
  });

  it("stops at the depth cap", () => {
    let nested: unknown = { "@type": "Recipe", name: "Deep" };
    for (let level = 0; level < 12; level += 1) {
      nested = { "@type": "WebPage", mainEntity: nested };
    }
    expect(findRecipeNode([nested])).toBeUndefined();
  });

  it("stops at the visit cap on a huge graph", () => {
    const graph = Array.from({ length: 20_000 }, (_, index) => ({
      "@type": "Thing",
      name: `n${index}`,
    }));
    graph.push({ "@type": "Recipe", name: "Too late" });
    expect(findRecipeNode([{ "@graph": graph }])).toBeUndefined();
  });
});

describe("cleanText", () => {
  it("decodes entities, strips tags and collapses whitespace", () => {
    expect(cleanText("  A&nbsp;&amp;&#39;B&#x27; <i>c</i>\n d &bogus; ")).toBe(
      "A &'B' c d &bogus;"
    );
  });

  it("leaves out-of-range code points alone", () => {
    expect(cleanText("&#9999999;")).toBe("&#9999999;");
  });
});
