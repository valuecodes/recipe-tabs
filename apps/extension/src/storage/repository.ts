import type { Recipe } from "~/lib/recipe";

// The pages talk to this type, never to `chrome.storage` directly, so a later
// IndexedDB implementation only has to provide the same shape.
type RecipeRepository = {
  list: () => Promise<Recipe[]>;
  get: (id: string) => Promise<Recipe | undefined>;
  // Idempotent: `false` and no write when the id is already saved, so a
  // second Save never resets `savedAt` or enrichment progress.
  insert: (recipe: Recipe) => Promise<boolean>;
  // Read-modify-write under a per-id lock. `false` when the recipe is gone
  // (never recreated) or the updater returns `undefined` (nothing written).
  update: (
    id: string,
    updater: (current: Recipe) => Recipe | undefined
  ) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
  subscribe: (listener: () => void) => () => void;
};

export type { RecipeRepository };
