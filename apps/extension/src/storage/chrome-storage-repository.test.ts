import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { recipeFromCapture } from "~/lib/recipe";
import type { Recipe } from "~/lib/recipe";
import { createChromeStorageRepository } from "~/storage/chrome-storage-repository";
import { createStorageStub } from "~/test/chrome-stub";

const makeRecipe = (path: string, savedAt: number): Recipe => {
  const recipe = recipeFromCapture(
    {
      url: `https://example.com/${path}`,
      title: path,
      documentLanguage: "en",
      jsonLd: [],
      text: "",
    },
    savedAt
  );
  if (recipe === undefined) {
    throw new Error("fixture URL rejected");
  }
  return recipe;
};

describe("createChromeStorageRepository", () => {
  let stub: ReturnType<typeof createStorageStub>;

  beforeEach(() => {
    stub = createStorageStub();
    vi.stubGlobal("chrome", stub.chrome);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("inserts, gets and lists newest first, skipping foreign and invalid keys", async () => {
    const repository = createChromeStorageRepository(stub.area);
    const older = makeRecipe("a", 1);
    const newer = makeRecipe("b", 2);
    expect(await repository.insert(older)).toBe(true);
    expect(await repository.insert(newer)).toBe(true);
    stub.data.set("settings", { theme: "dark" });
    stub.data.set("recipe:broken", { id: "broken" });

    expect(await repository.get(older.id)).toEqual(older);
    expect((await repository.list()).map((recipe) => recipe.id)).toEqual([
      newer.id,
      older.id,
    ]);
  });

  it("does not overwrite on a second insert", async () => {
    const repository = createChromeStorageRepository(stub.area);
    const first = makeRecipe("a", 1);
    await repository.insert(first);
    expect(await repository.insert({ ...first, savedAt: 99 })).toBe(false);
    expect((await repository.get(first.id))?.savedAt).toBe(1);
  });

  it("removes a recipe and update never recreates it", async () => {
    const repository = createChromeStorageRepository(stub.area);
    const recipe = makeRecipe("a", 1);
    await repository.insert(recipe);
    await repository.remove(recipe.id);
    expect(await repository.get(recipe.id)).toBeUndefined();
    expect(
      await repository.update(recipe.id, (current) => ({
        ...current,
        title: "x",
      }))
    ).toBe(false);
    expect(stub.data.size).toBe(0);
  });

  it("writes nothing when the updater returns undefined", async () => {
    const repository = createChromeStorageRepository(stub.area);
    const recipe = makeRecipe("a", 1);
    await repository.insert(recipe);
    expect(await repository.update(recipe.id, () => undefined)).toBe(false);
    expect(await repository.get(recipe.id)).toEqual(recipe);
  });

  it("serializes interleaved updates so none is lost", async () => {
    const repository = createChromeStorageRepository(stub.area);
    const recipe = makeRecipe("a", 1);
    await repository.insert(recipe);
    await Promise.all(
      ["first", "second", "third"].map((warning) =>
        repository.update(recipe.id, (current) => ({
          ...current,
          extraction: {
            ...current.extraction,
            warnings: [...current.extraction.warnings, warning],
          },
        }))
      )
    );
    expect((await repository.get(recipe.id))?.extraction.warnings).toEqual([
      "No structured recipe data on this page",
      "first",
      "second",
      "third",
    ]);
  });

  it("keeps an update that races the insert of the same id", async () => {
    const repository = createChromeStorageRepository(stub.area);
    const recipe = makeRecipe("a", 1);
    const [inserted, updated] = await Promise.all([
      repository.insert(recipe),
      repository.update(recipe.id, (current) => ({ ...current, title: "x" })),
    ]);
    expect(inserted).toBe(true);
    expect(updated).toBe(true);
    expect((await repository.get(recipe.id))?.title).toBe("x");
  });

  it("notifies only for local recipe keys", async () => {
    const repository = createChromeStorageRepository(stub.area);
    const listener = vi.fn();
    const unsubscribe = repository.subscribe(listener);
    stub.emit(["settings"]);
    stub.emit(["recipe:x"], "sync");
    expect(listener).not.toHaveBeenCalled();
    await repository.insert(makeRecipe("a", 1));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    await repository.remove(makeRecipe("a", 1).id);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
