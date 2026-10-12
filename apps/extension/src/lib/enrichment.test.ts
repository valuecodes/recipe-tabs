import { describe, expect, it } from "vitest";

import {
  ENRICH_STEPS,
  enrichmentLabel,
  findResumable,
  missingSteps,
  needsEnrichment,
  resetEnrichment,
  summarizeEnrichment,
} from "~/lib/enrichment";
import { isRecipe, NO_STRUCTURED_DATA } from "~/lib/recipe";
import type { Recipe } from "~/lib/recipe";

const makeRecipe = (
  id: string,
  enrichment: Recipe["enrichment"] = { status: "pending", completed: [] }
): Recipe => ({
  id,
  url: `https://example.com/${id}`,
  title: id,
  language: "en",
  ingredients: [],
  instructions: [],
  extraction: { method: "jsonld", warnings: [] },
  enrichment,
  savedAt: 1,
});

const DONE: Recipe["enrichment"] = {
  status: "done",
  completed: ["ingredients", "classification"],
};

describe("enrichment steps", () => {
  it("runs ingredients, then classification, in this build", () => {
    expect(ENRICH_STEPS).toEqual(["ingredients", "classification"]);
  });

  it("lists the current steps not yet completed", () => {
    expect(missingSteps(makeRecipe("a"))).toEqual([
      "ingredients",
      "classification",
    ]);
    expect(missingSteps(makeRecipe("a", DONE))).toEqual([]);
  });

  it("resumes a recipe finished before classification shipped", () => {
    const recipe = makeRecipe("a", {
      status: "done",
      completed: ["ingredients"],
    });
    expect(needsEnrichment(recipe)).toBe(true);
    expect(missingSteps(recipe)).toEqual(["classification"]);
  });

  it("treats a done recipe without a current step as unfinished", () => {
    const recipe = makeRecipe("a", {
      status: "done",
      completed: ["classification"],
    });
    expect(needsEnrichment(recipe)).toBe(true);
  });

  it("keeps steps from a newer build valid", () => {
    const recipe = makeRecipe("a", {
      status: "done",
      completed: ["ingredients", "classification", "nutrition"],
    });
    expect(isRecipe(recipe)).toBe(true);
    expect(needsEnrichment(recipe)).toBe(false);
  });
});

describe("findResumable", () => {
  it("skips finished, failed and lock-held recipes", () => {
    const recipes = [
      makeRecipe("pending"),
      makeRecipe("orphaned", { status: "running", runId: "x", completed: [] }),
      makeRecipe("live", { status: "running", runId: "y", completed: [] }),
      makeRecipe("failed", { status: "failed", completed: [], error: "e" }),
      makeRecipe("done", DONE),
    ];
    expect(
      findResumable(recipes, new Set(["live"])).map(({ id }) => id)
    ).toEqual(["pending", "orphaned"]);
  });

  it("picks up a run once its lock holder is gone", () => {
    const recipe = makeRecipe("a", {
      status: "running",
      runId: "x",
      completed: [],
    });
    expect(findResumable([recipe], new Set(["a"]))).toEqual([]);
    expect(findResumable([recipe], new Set())).toEqual([recipe]);
  });
});

describe("summarizeEnrichment", () => {
  it("counts running, waiting and failed recipes", () => {
    const recipes = [
      makeRecipe("a"),
      makeRecipe("b", { status: "running", runId: "x", completed: [] }),
      makeRecipe("c", { status: "failed", completed: [], error: "e" }),
      makeRecipe("d", DONE),
    ];
    expect(summarizeEnrichment(recipes, new Set(["b"]))).toEqual({
      waiting: 1,
      running: 1,
      failed: 1,
    });
  });
});

describe("enrichmentLabel", () => {
  it("names each state", () => {
    expect(enrichmentLabel(makeRecipe("a", DONE))).toBe("AI done");
    expect(enrichmentLabel(makeRecipe("a"))).toBe("Waiting for on-device AI");
    expect(
      enrichmentLabel(
        makeRecipe("a", { status: "running", runId: "x", completed: [] })
      )
    ).toBe("AI running…");
    expect(
      enrichmentLabel(
        makeRecipe("a", { status: "failed", completed: [], error: "boom" })
      )
    ).toBe("AI failed: boom");
    expect(
      enrichmentLabel(
        makeRecipe("a", { status: "done", completed: ["ingredients"] })
      )
    ).toBe("Waiting for on-device AI");
  });
});

describe("resetEnrichment", () => {
  it("restores JSON-LD lines and clears every AI result", () => {
    const recipe: Recipe = {
      ...makeRecipe("a", { ...DONE, runId: "x" }),
      language: "fi",
      title: "Pannukakku",
      titleEn: "Pancake",
      ingredients: [
        {
          rawText: "2 dl maitoa",
          rawTextEn: "2 dl milk",
          name: "milk",
          quantity: 2,
          unit: "dl",
        },
      ],
      classification: { dish: "pancake", category: "dessert", source: "ai" },
      nutrition: { kcal: { value: 300, basis: "unknown", source: "site" } },
      extraction: { method: "jsonld", warnings: ["Ignored 1 item"] },
    };
    const reset = resetEnrichment(recipe);
    expect(reset.ingredients).toEqual([{ rawText: "2 dl maitoa" }]);
    expect(reset.enrichment).toEqual({ status: "pending", completed: [] });
    expect(reset.extraction).toEqual({ method: "jsonld", warnings: [] });
    expect(reset.titleEn).toBeUndefined();
    expect(reset.classification).toBeUndefined();
    expect(reset.nutrition).toEqual(recipe.nutrition);
    expect(isRecipe(reset)).toBe(true);
  });

  it("drops ingredients read from page text so the text path runs again", () => {
    const recipe: Recipe = {
      ...makeRecipe("a", { status: "failed", completed: [], error: "e" }),
      ingredients: [{ rawText: "2 eggs", name: "egg", quantity: 2 }],
      pageText: "Ingredients\n2 eggs",
      extraction: {
        method: "ai",
        warnings: [NO_STRUCTURED_DATA, "Read from the page text"],
      },
    };
    const reset = resetEnrichment(recipe);
    expect(reset.ingredients).toEqual([]);
    expect(reset.pageText).toBe(recipe.pageText);
    expect(reset.extraction).toEqual({
      method: "text",
      warnings: [NO_STRUCTURED_DATA],
    });
    expect(reset.enrichment).toEqual({ status: "pending", completed: [] });
  });
});
