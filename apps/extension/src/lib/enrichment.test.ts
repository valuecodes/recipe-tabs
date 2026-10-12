import { describe, expect, it } from "vitest";

import {
  ENRICH_STEPS,
  findResumable,
  missingSteps,
  needsEnrichment,
  summarizeEnrichment,
} from "~/lib/enrichment";
import { isRecipe } from "~/lib/recipe";
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

describe("enrichment steps", () => {
  it("runs ingredients in this build", () => {
    expect(ENRICH_STEPS).toEqual(["ingredients"]);
  });

  it("lists the current steps not yet completed", () => {
    expect(missingSteps(makeRecipe("a"))).toEqual(["ingredients"]);
    expect(
      missingSteps(
        makeRecipe("a", { status: "done", completed: ["ingredients"] })
      )
    ).toEqual([]);
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
      makeRecipe("done", { status: "done", completed: ["ingredients"] }),
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
      makeRecipe("d", { status: "done", completed: ["ingredients"] }),
    ];
    expect(summarizeEnrichment(recipes, new Set(["b"]))).toEqual({
      waiting: 1,
      running: 1,
      failed: 1,
    });
  });
});
