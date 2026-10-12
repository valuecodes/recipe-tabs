import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyClassificationResult,
  runClassificationStep,
} from "~/ai/classification-step";
import type { Recipe } from "~/lib/recipe";
import { createAiStub } from "~/test/language-model-stub";
import type { AiStub } from "~/test/language-model-stub";

// All recipe content is invented.
const makeRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  id: "https://example.com/soup",
  url: "https://example.com/soup",
  title: "Tomato soup",
  language: "en",
  ingredients: [{ rawText: "4 tomatoes", name: "tomato" }, { rawText: "salt" }],
  instructions: [],
  extraction: { method: "jsonld", warnings: [] },
  enrichment: { status: "running", runId: "r", completed: ["ingredients"] },
  savedAt: 1,
  ...overrides,
});

const CLASSIFIED = JSON.stringify({ dish: "tomato soup", category: "soup" });

const quotaError = (): Error =>
  new DOMException("Input too large", "QuotaExceededError");

// The stubbed global, installed in `beforeEach`.
const base = (): Promise<LanguageModel> => LanguageModel.create();

describe("runClassificationStep", () => {
  let ai: AiStub;
  const signal = new AbortController().signal;

  beforeEach(() => {
    ai = createAiStub();
    for (const [name, value] of Object.entries(ai.globals)) {
      vi.stubGlobal(name, value);
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("classifies an English recipe from its title and names", async () => {
    ai.answers.push(CLASSIFIED);
    const result = await runClassificationStep(makeRecipe(), base, signal);
    expect(result).toEqual({
      classification: { dish: "tomato soup", category: "soup", source: "ai" },
      warnings: [],
    });
    expect(ai.calls.prompts[0]?.input).toContain("Title: Tomato soup");
    // The model's name when it has one, else the English line itself.
    expect(ai.calls.prompts[0]?.input).toContain("Ingredients: tomato, salt");
  });

  it("uses only English text for a Finnish recipe", async () => {
    ai.answers.push(CLASSIFIED);
    await runClassificationStep(
      makeRecipe({
        title: "Tomaattikeitto",
        titleEn: "Tomato soup",
        language: "fi",
        ingredients: [
          { rawText: "4 tomaattia", rawTextEn: "4 tomatoes", name: "tomato" },
          { rawText: "suolaa", rawTextEn: "salt" },
          { rawText: "pippuria" },
        ],
      }),
      base,
      signal
    );
    const input = ai.calls.prompts[0]?.input ?? "";
    expect(input).toContain("Title: Tomato soup");
    expect(input).toContain("Ingredients: tomato, salt");
    expect(input).not.toMatch(/Tomaattikeitto|pippuria/);
  });

  it("never prompts for Finnish without a translated title", async () => {
    const result = await runClassificationStep(
      makeRecipe({ title: "Tomaattikeitto", language: "fi" }),
      base,
      signal
    );
    expect(ai.calls.prompts).toEqual([]);
    expect(result.classification).toBeUndefined();
    expect(result.warnings[0]).toMatch(/^Not classified/);
  });

  it("never prompts for another language", async () => {
    const result = await runClassificationStep(
      makeRecipe({ language: "de" }),
      base,
      signal
    );
    expect(ai.calls.prompts).toEqual([]);
    expect(ai.calls.sessionsCreated).toBe(0);
    expect(result.warnings[0]).toMatch(/^Not classified/);
  });

  it("sends at most 40 names", async () => {
    ai.answers.push(CLASSIFIED);
    const ingredients = Array.from({ length: 45 }, (_, index) => ({
      rawText: `item${String(index + 1)}`,
    }));
    await runClassificationStep(makeRecipe({ ingredients }), base, signal);
    const input = ai.calls.prompts[0]?.input ?? "";
    expect(input).toContain("item40");
    expect(input).not.toContain("item41");
  });

  it("throws on an unusable answer", async () => {
    ai.answers.push(JSON.stringify({ dish: "", category: "soup" }));
    await expect(
      runClassificationStep(makeRecipe(), base, signal)
    ).rejects.toThrow("The AI's answer had no usable dish name");
  });

  it("retries with fewer names when the input overflows", async () => {
    ai.answers.push(quotaError(), CLASSIFIED);
    const ingredients = Array.from({ length: 30 }, (_, index) => ({
      rawText: `item${String(index + 1)}`,
    }));
    const result = await runClassificationStep(
      makeRecipe({ ingredients }),
      base,
      signal
    );
    expect(result.classification?.dish).toBe("tomato soup");
    expect(ai.calls.prompts[1]?.input).toContain("item15");
    expect(ai.calls.prompts[1]?.input).not.toContain("item16");
  });

  it("gives up after a second overflow", async () => {
    ai.answers.push(quotaError(), quotaError());
    await expect(
      runClassificationStep(makeRecipe(), base, signal)
    ).rejects.toThrow("The recipe was too long for the AI to classify");
  });
});

describe("applyClassificationResult", () => {
  it("stores the classification and completes the step", () => {
    const next = applyClassificationResult(makeRecipe(), {
      classification: { dish: "tomato soup", category: "soup", source: "ai" },
      warnings: [],
    });
    expect(next.classification?.dish).toBe("tomato soup");
    expect(next.enrichment.completed).toEqual([
      "ingredients",
      "classification",
    ]);
  });

  it("completes the step with a warning when nothing was classified", () => {
    const recipe = makeRecipe({
      extraction: { method: "jsonld", warnings: ["Not classified"] },
    });
    const next = applyClassificationResult(recipe, {
      warnings: ["Not classified"],
    });
    expect(next.classification).toBeUndefined();
    expect(next.extraction.warnings).toEqual(["Not classified"]);
    expect(next.enrichment.completed).toEqual([
      "ingredients",
      "classification",
    ]);
  });
});
