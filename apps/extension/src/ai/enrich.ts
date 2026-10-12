import {
  applyIngredientsResult,
  runIngredientsStep,
} from "~/ai/ingredients-step";
import { createRecipeSession } from "~/ai/session";
import { missingSteps } from "~/lib/enrichment";
import type { EnrichStep, Recipe } from "~/lib/recipe";
import type { RecipeRepository } from "~/storage/repository";

// Runs the AI steps for saved recipes. Closing the side panel kills its page
// and sessions mid-run, so the state lives in storage:
// - A run holds the Web Lock `enrich:<id>` while it works. Locks are shared by
//   every extension page and released when a page dies, so a `running` recipe
//   whose lock nobody holds was orphaned and can be resumed.
// - Every write is guarded by the run's `runId` inside the repository's
//   per-recipe lock: a stale run's writes are dropped, and a deleted recipe is
//   never recreated.
type Enricher = {
  // Queue a recipe; runs one at a time per page. Ignored when already queued
  // or running here, skipped at run time when another page holds its lock.
  enqueue: (id: string) => void;
  // Abort this page's run for the recipe and drop it from the queue.
  abort: (id: string) => void;
  // Resolves when the queue is empty.
  idle: () => Promise<void>;
};

type StepPatch = (current: Recipe) => Recipe;

const LOCK_PREFIX = "enrich:";

const lockName = (id: string): string => `${LOCK_PREFIX}${id}`;

// Recipe ids some live page is enriching right now.
const heldEnrichmentIds = async (): Promise<Set<string>> => {
  const { held = [] } = await navigator.locks.query();
  const ids = new Set<string>();
  for (const { name } of held) {
    if (name?.startsWith(LOCK_PREFIX) === true) {
      ids.add(name.slice(LOCK_PREFIX.length));
    }
  }
  return ids;
};

const runStep = async (
  step: EnrichStep,
  recipe: Recipe,
  base: LanguageModel,
  signal: AbortSignal
): Promise<StepPatch> => {
  if (step !== "ingredients") {
    throw new Error(`The ${step} step is not in this build`);
  }
  const result = await runIngredientsStep(recipe, base, signal);
  return (current) => applyIngredientsResult(current, result);
};

// Applies the patch only while the stored recipe still belongs to this run.
const guarded =
  (runId: string, patch: StepPatch) =>
  (current: Recipe): Recipe | undefined =>
    current.enrichment.runId === runId ? patch(current) : undefined;

const createEnricher = (repository: RecipeRepository): Enricher => {
  const queue: string[] = [];
  const controllers = new Map<string, AbortController>();
  let draining: Promise<void> | undefined;

  const run = async (id: string, signal: AbortSignal): Promise<void> => {
    const runId = crypto.randomUUID();
    let steps: EnrichStep[] = [];
    const started = await repository.update(id, (current) => {
      steps = missingSteps(current);
      const enrichment: Recipe["enrichment"] = {
        ...current.enrichment,
        status: "running",
        runId,
      };
      delete enrichment.error;
      return { ...current, enrichment };
    });
    if (!started) {
      return;
    }
    let base: LanguageModel | undefined;
    try {
      for (const step of steps) {
        const recipe = await repository.get(id);
        if (recipe?.enrichment.runId !== runId) {
          return;
        }
        base ??= await createRecipeSession(signal);
        const patch = await runStep(step, recipe, base, signal);
        if (!(await repository.update(id, guarded(runId, patch)))) {
          return;
        }
      }
      await repository.update(
        id,
        guarded(runId, (current) => ({
          ...current,
          enrichment: { ...current.enrichment, status: "done" },
        }))
      );
    } catch (error) {
      // Whoever aborted (delete, Re-run AI) owns the next state.
      if (signal.aborted) {
        return;
      }
      console.error(`AI enrichment failed for ${id}`, error);
      const message = error instanceof Error ? error.message : String(error);
      await repository.update(
        id,
        guarded(runId, (current) => ({
          ...current,
          enrichment: {
            ...current.enrichment,
            status: "failed",
            error: message,
          },
        }))
      );
    } finally {
      base?.destroy();
    }
  };

  const runLocked = async (id: string): Promise<void> => {
    const controller = new AbortController();
    controllers.set(id, controller);
    try {
      await navigator.locks.request(
        lockName(id),
        { ifAvailable: true },
        async (lock) => {
          if (lock !== null && !controller.signal.aborted) {
            await run(id, controller.signal);
          }
        }
      );
    } finally {
      if (controllers.get(id) === controller) {
        controllers.delete(id);
      }
    }
  };

  const drain = async (): Promise<void> => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      try {
        await runLocked(id);
      } catch (error) {
        console.error(`AI enrichment stopped for ${id}`, error);
      }
    }
    // Set in the same tick as the empty-queue check, so an `enqueue` can
    // never land between them and be left waiting.
    draining = undefined;
  };

  return {
    enqueue: (id) => {
      if (queue.includes(id) || controllers.has(id)) {
        return;
      }
      queue.push(id);
      draining ??= drain();
    },
    abort: (id) => {
      const queued = queue.indexOf(id);
      if (queued !== -1) {
        queue.splice(queued, 1);
      }
      controllers.get(id)?.abort();
    },
    idle: () => draining ?? Promise.resolve(),
  };
};

export { createEnricher, heldEnrichmentIds };
