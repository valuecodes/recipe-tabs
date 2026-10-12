import { describe, expect, it } from "vitest";

import { groupRecipes } from "~/lib/group";
import type { Recipe } from "~/lib/recipe";

// All recipe content is invented.
const makeRecipe = (
  id: string,
  classification?: Recipe["classification"]
): Recipe => {
  const recipe: Recipe = {
    id,
    url: `https://example.com/${id}`,
    title: id,
    language: "en",
    ingredients: [],
    instructions: [],
    extraction: { method: "jsonld", warnings: [] },
    enrichment: { status: "pending", completed: [] },
    savedAt: 1,
  };
  if (classification !== undefined) {
    recipe.classification = classification;
  }
  return recipe;
};

const summary = (recipes: Recipe[]) =>
  groupRecipes(recipes).map(({ key, label, kind, recipes: members }) => ({
    key,
    label,
    kind,
    ids: members.map(({ id }) => id),
  }));

describe("groupRecipes", () => {
  it("puts the same dish from different sites in one group", () => {
    const groups = summary([
      makeRecipe("a", {
        dish: "Panna cotta",
        category: "dessert",
        source: "ai",
      }),
      makeRecipe("b", { dish: "waffles", category: "breakfast", source: "ai" }),
      makeRecipe("c", {
        dish: " panna  cotta ",
        category: "dessert",
        source: "ai",
      }),
    ]);
    expect(groups).toEqual([
      {
        key: "dish:panna cotta",
        label: "panna cotta",
        kind: "dish",
        ids: ["a", "c"],
      },
      { key: "dish:waffles", label: "waffles", kind: "dish", ids: ["b"] },
    ]);
  });

  it("falls back to the category, then to Unclassified, last", () => {
    const groups = summary([
      makeRecipe("a"),
      makeRecipe("b", { dish: " ", category: "soup", source: "ai" }),
      makeRecipe("c", { dish: "apple pie", category: "baking", source: "ai" }),
    ]);
    expect(groups).toEqual([
      { key: "dish:apple pie", label: "apple pie", kind: "dish", ids: ["c"] },
      { key: "category:soup", label: "soup", kind: "category", ids: ["b"] },
      {
        key: "unclassified",
        label: "Unclassified",
        kind: "unclassified",
        ids: ["a"],
      },
    ]);
  });

  it("never merges a dish with a category of the same name", () => {
    const groups = summary([
      makeRecipe("a", { dish: "soup", category: "soup", source: "ai" }),
      makeRecipe("b", { dish: "", category: "soup", source: "ai" }),
    ]);
    expect(groups.map(({ key }) => key)).toEqual([
      "category:soup",
      "dish:soup",
    ]);
  });

  it("returns no groups for no recipes", () => {
    expect(groupRecipes([])).toEqual([]);
  });
});
