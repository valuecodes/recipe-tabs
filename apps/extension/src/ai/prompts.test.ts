import { describe, expect, it } from "vitest";

import { ingredientLinesPrompt, ingredientTextPrompt } from "~/ai/prompts";
import {
  INDEXED_INGREDIENTS_SCHEMA,
  TEXT_INGREDIENTS_SCHEMA,
} from "~/ai/schemas";

describe("ingredientLinesPrompt", () => {
  it("numbers lines from the batch offset and attaches the schema", () => {
    const request = ingredientLinesPrompt(["2 dl milk", "1\n egg"], 40);
    expect(request.input).toContain("\n41. 2 dl milk\n42. 1 egg");
    expect(request.responseConstraint).toBe(INDEXED_INGREDIENTS_SCHEMA);
  });
});

describe("ingredientTextPrompt", () => {
  it("embeds the window verbatim with the text schema", () => {
    const window = "Ingredients\n2 dl milk";
    const request = ingredientTextPrompt(window);
    expect(request.input.endsWith(`Text:\n${window}`)).toBe(true);
    expect(request.responseConstraint).toBe(TEXT_INGREDIENTS_SCHEMA);
  });
});
