import { useSyncExternalStore } from "react";

import type { Recipe } from "~/lib/recipe";
import { recipeStore } from "~/storage/app-recipes";

const EMPTY: readonly Recipe[] = [];

const useRecipes = (): { recipes: readonly Recipe[]; loading: boolean } => {
  const snapshot = useSyncExternalStore(
    recipeStore.subscribe,
    recipeStore.getSnapshot
  );
  return { recipes: snapshot ?? EMPTY, loading: snapshot === undefined };
};

export { useRecipes };
