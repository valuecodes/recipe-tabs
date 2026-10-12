import { describe, expect, it, vi } from "vitest";

import type { Recipe } from "~/lib/recipe";
import { createRecipeStore } from "~/storage/recipe-store";
import type { RecipeRepository } from "~/storage/repository";

type Deferred = PromiseWithResolvers<Recipe[]>;

const recipe = (id: string): Recipe => ({
  id,
  url: id,
  title: id,
  language: "en",
  ingredients: [],
  instructions: [],
  extraction: { method: "text", warnings: [] },
  enrichment: { status: "pending", completed: [] },
  savedAt: 0,
});

// A repository whose `list` calls resolve only when the test says so, and
// whose change listener the test fires by hand.
const controlledRepository = () => {
  const reads: Deferred[] = [];
  let onChange: (() => void) | undefined;
  const repository: RecipeRepository = {
    list: () => {
      const read = Promise.withResolvers<Recipe[]>();
      reads.push(read);
      return read.promise;
    },
    get: () => Promise.resolve(undefined),
    insert: () => Promise.resolve(true),
    update: () => Promise.resolve(true),
    remove: () => Promise.resolve(),
    subscribe: (listener) => {
      onChange = listener;
      return () => undefined;
    },
  };
  return { repository, reads, change: () => onChange?.() };
};

const flush = (): Promise<void> => new Promise((done) => setTimeout(done, 0));

describe("createRecipeStore", () => {
  it("does not lose a change that arrives during the initial load", async () => {
    const { repository, reads, change } = controlledRepository();
    const store = createRecipeStore(repository);
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.getSnapshot()).toBeUndefined();

    change();
    // The newer read resolves first, then the stale initial one.
    reads[1]?.resolve([recipe("new")]);
    await flush();
    reads[0]?.resolve([]);
    await flush();

    expect(store.getSnapshot()?.map((item) => item.id)).toEqual(["new"]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps the same snapshot reference until a change", async () => {
    const { repository, reads, change } = controlledRepository();
    const store = createRecipeStore(repository);
    store.subscribe(() => undefined);
    reads[0]?.resolve([recipe("a")]);
    await flush();
    const first = store.getSnapshot();
    expect(store.getSnapshot()).toBe(first);

    change();
    reads[1]?.resolve([recipe("a")]);
    await flush();
    expect(store.getSnapshot()).not.toBe(first);
  });

  it("loads once however many components subscribe", () => {
    const { repository, reads } = controlledRepository();
    const store = createRecipeStore(repository);
    store.subscribe(() => undefined);
    store.subscribe(() => undefined);
    expect(reads).toHaveLength(1);
  });
});
