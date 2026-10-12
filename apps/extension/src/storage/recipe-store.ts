import type { Recipe } from "~/lib/recipe";
import type { RecipeRepository } from "~/storage/repository";

// A cached, subscribable list of recipes for `useSyncExternalStore`.
// `undefined` means still loading. Each storage change re-reads the whole list
// and replaces the array reference; otherwise the reference stays stable.
type RecipeStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => readonly Recipe[] | undefined;
};

const createRecipeStore = (repository: RecipeRepository): RecipeStore => {
  let snapshot: readonly Recipe[] | undefined;
  let started = false;
  // Every read gets a generation; only the newest one may publish, so a
  // change that lands while an older read is in flight is never lost.
  let generation = 0;
  const listeners = new Set<() => void>();

  const refresh = async (): Promise<void> => {
    generation += 1;
    const mine = generation;
    try {
      const recipes = await repository.list();
      if (mine !== generation) {
        return;
      }
      snapshot = recipes;
    } catch (error) {
      console.error("Failed to load recipes", error);
      if (mine !== generation) {
        return;
      }
      snapshot ??= [];
    }
    for (const listener of listeners) {
      listener();
    }
  };

  const start = (): void => {
    if (started) {
      return;
    }
    started = true;
    repository.subscribe(() => {
      void refresh();
    });
    void refresh();
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      start();
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
  };
};

export { createRecipeStore };
