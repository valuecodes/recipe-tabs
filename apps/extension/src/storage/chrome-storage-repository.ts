import { isRecipe } from "~/lib/recipe";
import type { Recipe } from "~/lib/recipe";
import type { RecipeRepository } from "~/storage/repository";

// One key per recipe keeps writes small and lets `onChanged` say which recipe
// changed. Keys outside the prefix belong to something else and are ignored.
const KEY_PREFIX = "recipe:";

const keyOf = (id: string): string => `${KEY_PREFIX}${id}`;

// Web Locks are shared by every same-origin extension page (side panel,
// library), so two pages writing the same recipe are serialized.
const withLock = <T>(id: string, task: () => Promise<T>): Promise<T> =>
  navigator.locks.request(keyOf(id), task);

const createChromeStorageRepository = (
  area: chrome.storage.StorageArea = chrome.storage.local
): RecipeRepository => {
  const read = async (id: string): Promise<Recipe | undefined> => {
    const key = keyOf(id);
    const items = await area.get(key);
    const value: unknown = items[key];
    return isRecipe(value) ? value : undefined;
  };

  const write = (recipe: Recipe): Promise<void> =>
    area.set({ [keyOf(recipe.id)]: recipe });

  return {
    list: async () => {
      const items = await area.get(null);
      return Object.entries(items)
        .filter(([key]) => key.startsWith(KEY_PREFIX))
        .map(([, value]: [string, unknown]) => value)
        .filter(isRecipe)
        .sort((a, b) => b.savedAt - a.savedAt);
    },
    get: read,
    insert: (recipe) =>
      withLock(recipe.id, async () => {
        // A stored value that fails `isRecipe` is invisible to every page,
        // so it must not block saving: overwrite it.
        if ((await read(recipe.id)) !== undefined) {
          return false;
        }
        await write(recipe);
        return true;
      }),
    update: (id, updater) =>
      withLock(id, async () => {
        const current = await read(id);
        if (current === undefined) {
          return false;
        }
        const next = updater(current);
        if (next === undefined) {
          return false;
        }
        await write({ ...next, id });
        return true;
      }),
    remove: (id) => withLock(id, () => area.remove(keyOf(id))),
    subscribe: (listener) => {
      const onChanged = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: string
      ): void => {
        if (
          areaName === "local" &&
          Object.keys(changes).some((key) => key.startsWith(KEY_PREFIX))
        ) {
          listener();
        }
      };
      chrome.storage.onChanged.addListener(onChanged);
      return () => {
        chrome.storage.onChanged.removeListener(onChanged);
      };
    },
  };
};

export { createChromeStorageRepository };
