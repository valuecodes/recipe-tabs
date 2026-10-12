import { useEffect, useState } from "react";

import { enricher } from "~/ai/app-enricher";
import { isAiReady } from "~/ai/availability";
import { heldEnrichmentIds } from "~/ai/enrich";
import { needsEnrichment } from "~/lib/enrichment";
import { groupRecipes } from "~/lib/group";
import type { Recipe } from "~/lib/recipe";
import { GroupedList } from "~/library/grouped-list";
import type { RecipeActions } from "~/library/grouped-list";
import { useAiAvailability } from "~/sidepanel/use-ai-availability";
import { recipeRepository } from "~/storage/app-recipes";
import { useRecipes } from "~/storage/use-recipes";

// Recipes grouped by the AI's dish name. The library runs AI only when a
// button is clicked; resuming unfinished recipes is the side panel's job.
// A page that dies mid-run releases its lock without a storage change, so the
// "running" badges are also re-checked on a timer.
const RESCAN_MS = 30_000;

const logError =
  (what: string) =>
  (error: unknown): void => {
    console.error(what, error);
  };

const Library = () => {
  const { recipes, loading } = useRecipes();
  const { status, refresh } = useAiAvailability();
  const ready = isAiReady(status);
  const [heldIds, setHeldIds] = useState<ReadonlySet<string>>(new Set());

  // AI is enabled from the side panel, in another tab: re-check whenever this
  // tab is shown again.
  useEffect(() => {
    const onVisible = (): void => {
      if (document.visibilityState === "visible") {
        refresh().catch(logError("Failed to check on-device AI"));
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const unfinished = recipes.some(needsEnrichment);
  useEffect(() => {
    let cancelled = false;
    const scan = (): void => {
      heldEnrichmentIds()
        .then((held) => {
          if (!cancelled) {
            setHeldIds(held);
          }
        })
        .catch(logError("Failed to check AI enrichment"));
    };
    scan();
    const timer = unfinished ? setInterval(scan, RESCAN_MS) : undefined;
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [recipes, unfinished]);

  const actions: RecipeActions = {
    ready,
    heldIds,
    onFinish: (id) => {
      enricher.enqueue(id);
    },
    onRerun: (id) => {
      enricher.rerun(id).catch(logError("Failed to re-run AI"));
    },
    onDelete: (recipe: Recipe) => {
      if (!globalThis.confirm(`Delete "${recipe.title}"?`)) {
        return;
      }
      // A run in another page stops at its next write: the recipe is gone.
      enricher.abort(recipe.id);
      recipeRepository
        .remove(recipe.id)
        .catch(logError("Failed to delete the recipe"));
    },
  };

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold">Recipe library</h1>
      {loading ? (
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Loading…</p>
      ) : null}
      {!loading && recipes.length === 0 ? (
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          No saved recipes yet. Use the side panel on a recipe page.
        </p>
      ) : null}
      {!loading && recipes.length > 0 && !ready ? (
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Enable on-device AI in the side panel to run AI here.
        </p>
      ) : null}
      <GroupedList groups={groupRecipes(recipes)} actions={actions} />
    </main>
  );
};

export { Library };
