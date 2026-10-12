import {
  CATEGORIES,
  CLASSIFICATION_SCHEMA,
  INDEXED_INGREDIENTS_SCHEMA,
  TEXT_INGREDIENTS_SCHEMA,
} from "~/ai/schemas";

// Pure prompt builders: what goes to `session.prompt(input, { responseConstraint })`.
type PromptRequest = {
  input: string;
  responseConstraint: Record<string, unknown>;
  // The input describes the shape in prose, so the schema is not also added
  // to the context (it costs tokens).
  omitResponseConstraintInput?: boolean;
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

const classificationPrompt = (
  title: string,
  names: readonly string[]
): PromptRequest => ({
  input: [
    "Classify this recipe. Answer with JSON: " +
      '{"dish": the short canonical English name of the dish in lower case, ' +
      'such as "panna cotta" or "lasagne", "category": one of ' +
      `${CATEGORIES.join(", ")}, "cuisine": the cuisine in lower case, ` +
      "only when it is clear}.",
    "",
    `Title: ${oneLine(title)}`,
    `Ingredients: ${names.map(oneLine).join(", ")}`,
  ].join("\n"),
  responseConstraint: CLASSIFICATION_SCHEMA,
  omitResponseConstraintInput: true,
});

export type { PromptRequest };
export { classificationPrompt, ingredientLinesPrompt, ingredientTextPrompt };
