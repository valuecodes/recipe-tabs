import {
  INDEXED_INGREDIENTS_SCHEMA,
  TEXT_INGREDIENTS_SCHEMA,
} from "~/ai/schemas";

// Pure prompt builders: what goes to `session.prompt(input, { responseConstraint })`.
type PromptRequest = {
  input: string;
  responseConstraint: Record<string, unknown>;
};

const oneLine = (text: string): string => text.replaceAll(/\s+/g, " ").trim();

// Lines are numbered from `offset + 1`, so every batch keeps the recipe-wide
// index and results map back to the right ingredient.
const ingredientLinesPrompt = (
  lines: readonly string[],
  offset: number
): PromptRequest => ({
  input: [
    "For each numbered ingredient line, return its index, the ingredient name " +
      "without the amount, and the quantity as a number and the unit when the " +
      "line has them.",
    "",
    ...lines.map((line, index) => `${offset + index + 1}. ${oneLine(line)}`),
  ].join("\n"),
  responseConstraint: INDEXED_INGREDIENTS_SCHEMA,
});

const ingredientTextPrompt = (window: string): PromptRequest => ({
  input: [
    "The text below is part of a recipe web page. List every ingredient line " +
      "in it. Copy each line exactly as `text`, then give the ingredient " +
      "name, and the quantity as a number and the unit when the line has " +
      "them. Skip anything that is not an ingredient.",
    "",
    "Text:",
    window,
  ].join("\n"),
  responseConstraint: TEXT_INGREDIENTS_SCHEMA,
});

export type { PromptRequest };
export { ingredientLinesPrompt, ingredientTextPrompt };
