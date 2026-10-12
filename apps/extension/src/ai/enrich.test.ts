import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createEnricher, heldEnrichmentIds } from "~/ai/enrich";
import type { Recipe } from "~/lib/recipe";
import { createChromeStorageRepository } from "~/storage/chrome-storage-repository";
import type { RecipeRepository } from "~/storage/repository";
import { createStorageStub } from "~/test/chrome-stub";
import { createAiStub } from "~/test/language-model-stub";
import type { AiStub, PromptAnswer } from "~/test/language-model-stub";

// All recipe content is invented.
const ID = "https://example.com/pancakes";

const makeRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  id: ID,
  url: ID,
  title: "Pancakes",
  language: "en",
  ingredients: [{ rawText: "2 dl milk" }, { rawText: "1 egg" }],
  instructions: [],
  extraction: { method: "jsonld", warnings: [] },
  enrichment: { status: "pending", completed: [] },
  savedAt: 1,
  ...overrides,
});

const answer = (ingredients: unknown[]): string =>
  JSON.stringify({ ingredients });

const quotaError = (): Error =>
  new DOMException("Input too large", "QuotaExceededError");

const FINNISH = [{ detectedLanguage: "fi", confidence: 0.95 }];

describe("createEnricher", () => {
  let storage: ReturnType<typeof createStorageStub>;
  let repository: RecipeRepository;
  let ai: AiStub;

  const install = (options: Parameters<typeof createAiStub>[0] = {}): void => {
    ai = createAiStub(options);
    for (const [name, value] of Object.entries(ai.globals)) {
      vi.stubGlobal(name, value);
    }
  };

  const enrich = async (
    recipe: Recipe,
    answers: PromptAnswer[] = []
  ): Promise<Recipe | undefined> => {
    ai.answers.push(...answers);
    await repository.insert(recipe);
    const enricher = createEnricher(repository);
    enricher.enqueue(recipe.id);
    await enricher.idle();
    return repository.get(recipe.id);
  };

  beforeEach(() => {
    storage = createStorageStub();
    vi.stubGlobal("chrome", storage.chrome);
    repository = createChromeStorageRepository(storage.area);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    install();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("translates a Finnish recipe and merges ingredients by index", async () => {
    install({ detected: FINNISH });
    const stored = await enrich(
      makeRecipe({
        title: "Pannukakku",
        language: "fi-FI",
        ingredients: [{ rawText: "2 dl maitoa" }, { rawText: "1 muna" }],
      }),
      [
        answer([
          { index: 1, name: "milk", quantity: 2, unit: "dl" },
          { index: 2, name: "egg", quantity: 1 },
        ]),
      ]
    );
    expect(stored?.titleEn).toBe("EN Pannukakku");
    expect(stored?.language).toBe("fi");
    expect(stored?.ingredients).toEqual([
      {
        rawText: "2 dl maitoa",
        rawTextEn: "EN 2 dl maitoa",
        name: "milk",
        quantity: 2,
        unit: "dl",
      },
      { rawText: "1 muna", rawTextEn: "EN 1 muna", name: "egg", quantity: 1 },
    ]);
    expect(stored?.enrichment).toMatchObject({
      status: "done",
      completed: ["ingredients"],
    });
    expect(ai.calls.prompts[0]?.input).toContain("1. EN 2 dl maitoa");
  });

  it("does not translate an English recipe", async () => {
    const stored = await enrich(makeRecipe(), [
      answer([{ index: 1, name: "milk" }]),
    ]);
    expect(ai.calls.translated).toEqual([]);
    expect(stored?.titleEn).toBeUndefined();
    expect(stored?.ingredients[0]).toEqual({
      rawText: "2 dl milk",
      name: "milk",
    });
    expect(stored?.enrichment.status).toBe("done");
  });

  it("reads page text, keeping only lines the AI quoted", async () => {
    const stored = await enrich(
      makeRecipe({
        ingredients: [],
        extraction: { method: "text", warnings: ["No structured data"] },
        pageText: "Our story\nIngredients\n2 dl milk\n1 egg\nMethod\nMix.",
      }),
      [
        answer([
          { text: "2 dl milk", name: "milk", quantity: 2, unit: "dl" },
          { text: "3 cups of unicorn tears", name: "tears" },
          { text: "2 DL  milk", name: "milk again" },
        ]),
      ]
    );
    expect(stored?.ingredients).toEqual([
      { rawText: "2 dl milk", name: "milk", quantity: 2, unit: "dl" },
    ]);
    expect(stored?.extraction.method).toBe("ai");
    expect(stored?.extraction.warnings).toEqual([
      "No structured data",
      "Ingredients were read by the on-device AI from the page text",
      "Ignored 2 ingredient(s) the AI did not quote from the page",
    ]);
  });

  it("warns when the page text has no ingredients heading", async () => {
    const stored = await enrich(
      makeRecipe({ ingredients: [], pageText: "2 dl milk and a story" }),
      [answer([{ text: "2 dl milk", name: "milk" }])]
    );
    expect(stored?.extraction.warnings).toContain(
      "No ingredients heading found on the page"
    );
  });

  it("completes without a prompt when there is no ingredient text", async () => {
    const stored = await enrich(makeRecipe({ ingredients: [] }));
    expect(ai.calls.prompts).toEqual([]);
    expect(stored?.enrichment.status).toBe("done");
    expect(stored?.extraction.warnings).toEqual(["No ingredient text to read"]);
  });

  it("never prompts with an unsupported language", async () => {
    install({ detected: [{ detectedLanguage: "de", confidence: 0.95 }] });
    const stored = await enrich(makeRecipe({ title: "Pfannkuchen mit Milch" }));
    expect(ai.calls.prompts).toEqual([]);
    expect(stored?.language).toBe("de");
    expect(stored?.enrichment.status).toBe("done");
    expect(stored?.extraction.warnings[0]).toMatch(/Ingredients in "de"/);
  });

  it("batches 40 lines with recipe-wide indexes", async () => {
    const ingredients = Array.from({ length: 45 }, (_, index) => ({
      rawText: `line ${String(index + 1)}`,
    }));
    const stored = await enrich(makeRecipe({ ingredients }), [
      answer([{ index: 1, name: "first" }]),
      answer([{ index: 45, name: "last" }]),
    ]);
    expect(ai.calls.prompts).toHaveLength(2);
    expect(ai.calls.prompts[1]?.input).toContain("\n41. line 41");
    expect(stored?.ingredients[0]?.name).toBe("first");
    expect(stored?.ingredients[44]?.name).toBe("last");
    // One base session, one clone per prompt, all destroyed.
    expect(ai.calls.sessionsCreated).toBe(1);
    expect(ai.calls.clonesCreated).toBe(2);
    expect(ai.calls.destroyed).toBe(3);
  });

  it("splits a batch that overflows the context", async () => {
    const ingredients = ["a", "b", "c", "d"].map((rawText) => ({ rawText }));
    const stored = await enrich(makeRecipe({ ingredients }), [
      quotaError(),
      answer([
        { index: 1, name: "a" },
        { index: 2, name: "b" },
      ]),
      answer([
        { index: 3, name: "c" },
        { index: 4, name: "d" },
      ]),
    ]);
    expect(ai.calls.prompts).toHaveLength(3);
    expect(stored?.ingredients.map(({ name }) => name)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("keeps partial results with a warning when one batch is malformed", async () => {
    const ingredients = Array.from({ length: 41 }, (_, index) => ({
      rawText: `line ${String(index + 1)}`,
    }));
    const stored = await enrich(makeRecipe({ ingredients }), [
      "{broken",
      answer([{ index: 41, name: "last" }]),
    ]);
    expect(stored?.enrichment.status).toBe("done");
    expect(stored?.extraction.warnings).toContain(
      "The AI's answer was not valid JSON"
    );
  });

  it("fails when nothing usable came back, then retries only the step", async () => {
    let stored = await enrich(makeRecipe(), ["{broken"]);
    expect(stored?.enrichment).toMatchObject({
      status: "failed",
      completed: [],
      error: "The AI's answer was not valid JSON",
    });

    ai.answers.push(answer([{ index: 1, name: "milk" }]));
    const enricher = createEnricher(repository);
    enricher.enqueue(ID);
    await enricher.idle();
    stored = await repository.get(ID);
    expect(stored?.enrichment.status).toBe("done");
    expect(stored?.enrichment.error).toBeUndefined();
  });

  it("records a thrown model error as failed", async () => {
    const stored = await enrich(makeRecipe(), [new Error("model crashed")]);
    expect(stored?.enrichment).toMatchObject({
      status: "failed",
      error: "model crashed",
    });
    expect(ai.calls.destroyed).toBe(2);
  });

  it("(a) never recreates a recipe deleted during a step", async () => {
    const stored = await enrich(makeRecipe(), [
      async () => {
        await repository.remove(ID);
        return answer([{ index: 1, name: "milk" }]);
      },
    ]);
    expect(stored).toBeUndefined();
    expect(storage.data.size).toBe(0);
  });

  it("(b) drops a stale run's writes", async () => {
    const stored = await enrich(makeRecipe(), [
      async () => {
        await repository.update(ID, (current) => ({
          ...current,
          enrichment: { ...current.enrichment, runId: "another-run" },
        }));
        return answer([{ index: 1, name: "milk" }]);
      },
    ]);
    expect(stored?.enrichment).toMatchObject({
      status: "running",
      runId: "another-run",
      completed: [],
    });
    expect(stored?.ingredients[0]?.name).toBeUndefined();
  });

  it("(c) runs only missing steps", async () => {
    const stored = await enrich(
      makeRecipe({ enrichment: { status: "done", completed: ["ingredients"] } })
    );
    expect(ai.calls.prompts).toEqual([]);
    expect(ai.calls.sessionsCreated).toBe(0);
    expect(stored?.enrichment.status).toBe("done");
  });

  it("(d) aborts the in-flight prompt and leaves storage alone", async () => {
    ai.answers.push(
      (_input, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        })
    );
    await repository.insert(makeRecipe());
    const enricher = createEnricher(repository);
    enricher.enqueue(ID);
    await vi.waitFor(() => {
      expect(ai.calls.prompts).toHaveLength(1);
    });
    enricher.abort(ID);
    await enricher.idle();
    expect(ai.calls.prompts[0]?.signal?.aborted).toBe(true);
    const stored = await repository.get(ID);
    expect(stored?.enrichment.status).toBe("running");
    expect(stored?.ingredients[0]?.name).toBeUndefined();
    expect(ai.calls.destroyed).toBe(2);
  });

  it("(e) skips a recipe another page is enriching", async () => {
    await repository.insert(makeRecipe());
    const enricher = createEnricher(repository);
    await navigator.locks.request(`enrich:${ID}`, async () => {
      expect(await heldEnrichmentIds()).toEqual(new Set([ID]));
      enricher.enqueue(ID);
      await enricher.idle();
    });
    expect(ai.calls.prompts).toEqual([]);
    expect((await repository.get(ID))?.enrichment.status).toBe("pending");
  });

  it("runs a recipe queued twice only once", async () => {
    ai.answers.push(answer([{ index: 1, name: "milk" }]));
    await repository.insert(makeRecipe());
    const enricher = createEnricher(repository);
    enricher.enqueue(ID);
    enricher.enqueue(ID);
    await enricher.idle();
    expect(ai.calls.prompts).toHaveLength(1);
    expect(await heldEnrichmentIds()).toEqual(new Set());
  });
});
