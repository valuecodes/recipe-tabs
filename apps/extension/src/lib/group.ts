import type { Recipe } from "~/lib/recipe";

// Library groups: by the AI's dish name, else its category, else
// "Unclassified". Keys carry their kind, so a dish called "soup" never merges
// with the "soup" category.
type RecipeGroup = {
  key: string;
  label: string;
  kind: "dish" | "category" | "unclassified";
  recipes: Recipe[];
};

const UNCLASSIFIED = "unclassified";

const normalize = (text: string): string =>
  text.replaceAll(/\s+/g, " ").trim().toLowerCase();

const groupOf = (recipe: Recipe): Omit<RecipeGroup, "recipes"> => {
  const dish = normalize(recipe.classification?.dish ?? "");
  if (dish !== "") {
    return { key: `dish:${dish}`, label: dish, kind: "dish" };
  }
  const category = normalize(recipe.classification?.category ?? "");
  if (category !== "") {
    return { key: `category:${category}`, label: category, kind: "category" };
  }
  return { key: UNCLASSIFIED, label: "Unclassified", kind: "unclassified" };
};

// Groups sorted by label with "Unclassified" last; each group keeps the input
// order of its recipes.
const groupRecipes = (recipes: readonly Recipe[]): RecipeGroup[] => {
  const groups = new Map<string, RecipeGroup>();
  for (const recipe of recipes) {
    const group = groupOf(recipe);
    const existing = groups.get(group.key);
    if (existing === undefined) {
      groups.set(group.key, { ...group, recipes: [recipe] });
    } else {
      existing.recipes.push(recipe);
    }
  }
  const rank = (group: RecipeGroup): number =>
    group.kind === "unclassified" ? 1 : 0;
  return [...groups.values()].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) {
      return byRank;
    }
    const byLabel = a.label.localeCompare(b.label);
    return byLabel === 0 ? a.kind.localeCompare(b.kind) : byLabel;
  });
};

export type { RecipeGroup };
export { groupRecipes };
