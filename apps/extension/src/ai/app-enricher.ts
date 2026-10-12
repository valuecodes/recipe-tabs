import { createEnricher } from "~/ai/enrich";
import { recipeRepository } from "~/storage/app-recipes";

// The page-wide enricher. Kept apart from the factory so tests can import
// that without a `chrome` global.
const enricher = createEnricher(recipeRepository);

export { enricher };
