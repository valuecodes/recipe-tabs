import { describe, expect, it } from "vitest";

import type { PageCapture } from "~/lib/page-capture";
import { isRecipe, recipeFromCapture } from "~/lib/recipe";
import { finnishGraph, noRecipe } from "~/test/fixtures/json-ld";

const capture = (overrides: Partial<PageCapture> = {}): PageCapture => ({
  url: "https://example.fi/resepti/panna-cotta/?utm_source=x",
  title: "Panna cotta | Keittiö Esimerkki",
  documentLanguage: "en",
  jsonLd: [finnishGraph],
  text: "Page text",
  ...overrides,
});

describe("recipeFromCapture", () => {
  it("builds a JSON-LD recipe; inLanguage wins over the page lang", () => {
    const recipe = recipeFromCapture(capture(), 1000);
    expect(recipe).toMatchObject({
      id: "https://example.fi/resepti/panna-cotta",
      url: "https://example.fi/resepti/panna-cotta/?utm_source=x",
      title: "Mansikka & vanilja panna cotta",
      language: "fi-fi",
      servings: 4,
      extraction: { method: "jsonld", warnings: [] },
      enrichment: { status: "pending", completed: [] },
      savedAt: 1000,
    });
    expect(recipe?.ingredients).toEqual([
      { rawText: "4 dl kermaa" },
      { rawText: "1 dl sokeria" },
      { rawText: "3 liivatelehteä" },
    ]);
    expect(recipe?.nutrition?.kcal?.value).toBe(412);
    expect(recipe?.pageText).toBeUndefined();
  });

  it("falls back to the page when there is no Recipe JSON-LD", () => {
    const recipe = recipeFromCapture(
      capture({ jsonLd: [noRecipe], documentLanguage: " FI " }),
      1
    );
    expect(recipe).toMatchObject({
      title: "Panna cotta | Keittiö Esimerkki",
      language: "fi",
      ingredients: [],
      pageText: "Page text",
      extraction: {
        method: "text",
        warnings: ["No structured recipe data on this page"],
      },
    });
  });

  it("uses 'und' without any language and the id without a title", () => {
    const recipe = recipeFromCapture(
      capture({ jsonLd: [], documentLanguage: "", title: "  " }),
      1
    );
    expect(recipe?.language).toBe("und");
    expect(recipe?.title).toBe("https://example.fi/resepti/panna-cotta");
  });

  it("rejects non-http pages", () => {
    expect(
      recipeFromCapture(capture({ url: "chrome://newtab/" }), 1)
    ).toBeUndefined();
  });
});

describe("isRecipe", () => {
  const recipe = recipeFromCapture(capture(), 1000);

  it("accepts a built recipe after a storage round trip", () => {
    expect(isRecipe(structuredClone(recipe))).toBe(true);
  });

  it.each([
    ["ingredient without rawText", { ingredients: [{ name: "x" }] }],
    ["non-string instruction", { instructions: ["a", 2] }],
    [
      "bad nutrition value",
      { nutrition: { kcal: { value: "1", basis: "unknown", source: "site" } } },
    ],
    [
      "bad nutrition basis",
      { nutrition: { kcal: { value: 1, basis: "per-100g", source: "site" } } },
    ],
    [
      "unknown enrichment step",
      { enrichment: { status: "done", completed: ["tagging"] } },
    ],
    [
      "unknown enrichment status",
      { enrichment: { status: "x", completed: [] } },
    ],
    ["bad extraction method", { extraction: { method: "x", warnings: [] } }],
    ["zero servings", { servings: 0 }],
    ["missing savedAt", { savedAt: undefined }],
  ])("rejects %s", (_label, patch) => {
    expect(isRecipe({ ...recipe, ...patch })).toBe(false);
  });
});
