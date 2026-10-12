import { NO_STRUCTURED_DATA } from "~/lib/recipe";
import type { EnrichStep, Recipe } from "~/lib/recipe";

// The AI steps this build runs, in order. The list grows as steps ship, so a
// recipe finished by an older build counts as unfinished until it has run the
// new steps too.
const ENRICH_STEPS: readonly EnrichStep[] = ["ingredients", "classification"];

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

const enrichmentLabel = (recipe: Recipe): string => {
  if (!needsEnrichment(recipe)) {
    return "AI done";
  }
  const { status, error } = recipe.enrichment;
  if (status === "failed") {
    return `AI failed: ${error ?? "unknown error"}`;
  }
  // `done` here means an older build finished; this one has new steps.
  return status === "running" ? "AI running…" : "Waiting for on-device AI";
};

// "Re-run AI": back to what the capture produced, so every step runs again.
// Ingredients the AI read from page text are dropped, so the text path reads
// the page text again instead of treating its own output as JSON-LD lines.
const resetEnrichment = (recipe: Recipe): Recipe => {
  const fromText = recipe.extraction.method !== "jsonld";
  const next: Recipe = {
    ...recipe,
    ingredients:
      recipe.extraction.method === "ai" && recipe.pageText !== undefined
        ? []
        : recipe.ingredients.map(({ rawText }) => ({ rawText })),
    extraction: {
      method:
        recipe.extraction.method === "ai" ? "text" : recipe.extraction.method,
      warnings: fromText ? [NO_STRUCTURED_DATA] : [],
    },
    enrichment: { status: "pending", completed: [] },
  };
  delete next.titleEn;
  delete next.classification;
  return next;
};

export {
  ENRICH_STEPS,
  enrichmentLabel,
  findResumable,
  missingSteps,
  needsEnrichment,
  resetEnrichment,
  summarizeEnrichment,
};
