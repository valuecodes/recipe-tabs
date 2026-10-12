import { createChromeStorageRepository } from "~/storage/chrome-storage-repository";
import { createRecipeStore } from "~/storage/recipe-store";

// The page-wide repository and store. Kept apart from the factories so tests
// can import those without a `chrome` global.
const recipeRepository = createChromeStorageRepository();
const recipeStore = createRecipeStore(recipeRepository);

export { recipeRepository, recipeStore };
