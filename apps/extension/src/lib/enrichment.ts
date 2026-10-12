import type { EnrichStep, Recipe } from "~/lib/recipe";

// The AI steps this build runs, in order. The list grows as steps ship, so a
// recipe finished by an older build counts as unfinished until it has run the
// new steps too.
const ENRICH_STEPS: readonly EnrichStep[] = ["ingredients"];

const missingSteps = (recipe: Recipe): EnrichStep[] =>
  ENRICH_STEPS.filter((step) => !recipe.enrichment.completed.includes(step));

const needsEnrichment = (recipe: Recipe): boolean =>
  missingSteps(recipe).length > 0;

// Recipes to resume without a click: unfinished, not failed (a failure waits
// for "Finish AI"), and not being enriched by any live page. A `running`
// status whose lock nobody holds belongs to a page that died mid-run.
const findResumable = (
  recipes: readonly Recipe[],
  heldIds: ReadonlySet<string>
): Recipe[] =>
  recipes.filter(
    (recipe) =>
      needsEnrichment(recipe) &&
      recipe.enrichment.status !== "failed" &&
      !heldIds.has(recipe.id)
  );

type EnrichmentSummary = { waiting: number; running: number; failed: number };

const summarizeEnrichment = (
  recipes: readonly Recipe[],
  heldIds: ReadonlySet<string>
): EnrichmentSummary => {
  const summary: EnrichmentSummary = { waiting: 0, running: 0, failed: 0 };
  for (const recipe of recipes) {
    if (heldIds.has(recipe.id)) {
      summary.running += 1;
    } else if (needsEnrichment(recipe)) {
      if (recipe.enrichment.status === "failed") {
        summary.failed += 1;
      } else {
        summary.waiting += 1;
      }
    }
  }
  return summary;
};

export {
  ENRICH_STEPS,
  findResumable,
  missingSteps,
  needsEnrichment,
  summarizeEnrichment,
};
