import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createEnricher, heldEnrichmentIds } from "~/ai/enrich";
import type { EnrichStep, Recipe } from "~/lib/recipe";
import { createChromeStorageRepository } from "~/storage/chrome-storage-repository";
import type { RecipeRepository } from "~/storage/repository";
import { createStorageStub } from "~/test/chrome-stub";
import { createAiStub } from "~/test/language-model-stub";
import type { AiStub, PromptAnswer } from "~/test/language-model-stub";

// "Re-run AI". All recipe content is invented.
const ID = "https://example.com/pancakes";

const BOTH_STEPS: EnrichStep[] = ["ingredients", "classification"];

const makeRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  id: ID,
  url: ID,
  title: "Pancakes",
  language: "en",
  ingredients: [{ rawText: "2 dl milk" }],
  instructions: [],
  extraction: { method: "jsonld", warnings: [] },
  enrichment: { status: "pending", completed: [] },
  savedAt: 1,
  ...overrides,
});

const INGREDIENTS = JSON.stringify({
  ingredients: [{ index: 1, name: "milk" }],
});
const CLASSIFIED = JSON.stringify({ dish: "Pancake", category: "breakfast" });

// A prompt that only ends when it is aborted.
const hang: PromptAnswer = (_input, signal) =>
  new Promise((_resolve, reject) => {
    signal?.addEventListener("abort", () => {
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

describe("rerun", () => {
  let repository: RecipeRepository;
  let ai: AiStub;

  beforeEach(() => {
    const storage = createStorageStub();
    vi.stubGlobal("chrome", storage.chrome);
    repository = createChromeStorageRepository(storage.area);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    ai = createAiStub();
    for (const [name, value] of Object.entries(ai.globals)) {
      vi.stubGlobal(name, value);
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("aborts this page's run, resets and runs every step once", async () => {
    ai.answers.push(hang);
    await repository.insert(
      makeRecipe({
        classification: { dish: "crepe", category: "dessert", source: "ai" },
        enrichment: { status: "failed", completed: [], error: "old" },
      })
    );
    const enricher = createEnricher(repository);
    enricher.enqueue(ID);
    await vi.waitFor(() => {
      expect(ai.calls.prompts).toHaveLength(1);
    });
    ai.answers.push(INGREDIENTS, CLASSIFIED);
    expect(await enricher.rerun(ID)).toBe(true);
    await enricher.idle();
    expect(ai.calls.prompts[0]?.signal?.aborted).toBe(true);
    expect(ai.calls.prompts).toHaveLength(3);
    const stored = await repository.get(ID);
    expect(stored?.enrichment).toMatchObject({
      status: "done",
      completed: BOTH_STEPS,
    });
    expect(stored?.enrichment.error).toBeUndefined();
    expect(stored?.classification?.dish).toBe("pancake");
  });

  it("waits for another page's run instead of skipping", async () => {
    await repository.insert(
      makeRecipe({ enrichment: { status: "done", completed: BOTH_STEPS } })
    );
    ai.answers.push(INGREDIENTS, CLASSIFIED);
    const enricher = createEnricher(repository);
    const { promise: held, resolve: release } = Promise.withResolvers<void>();
    const otherPage = navigator.locks.request(`enrich:${ID}`, () => held);
    await vi.waitFor(async () => {
      expect(await heldEnrichmentIds()).toEqual(new Set([ID]));
    });
    expect(await enricher.rerun(ID)).toBe(true);
    // Reset, but still waiting for the other page's lock.
    expect((await repository.get(ID))?.enrichment).toEqual({
      status: "pending",
      completed: [],
    });
    expect(ai.calls.prompts).toEqual([]);
    release();
    await otherPage;
    await enricher.idle();
    expect(ai.calls.prompts).toHaveLength(2);
    expect((await repository.get(ID))?.enrichment.status).toBe("done");
  });

  it("returns false and writes nothing for a deleted recipe", async () => {
    const enricher = createEnricher(repository);
    expect(await enricher.rerun(ID)).toBe(false);
    await enricher.idle();
    expect(await repository.get(ID)).toBeUndefined();
    expect(ai.calls.prompts).toEqual([]);
  });
});
