import { isRecord } from "~/lib/guards";
import { fromSchemaNutrition } from "~/lib/nutrition";
import type { Nutrition } from "~/lib/nutrition";
import { parseServings } from "~/lib/servings";

type RecipeNode = Record<string, unknown>;

type SchemaRecipe = {
  title?: string;
  ingredients: string[];
  instructions: string[];
  servings?: number;
  nutrition?: Nutrition;
  language?: string;
};

// Bounds for a page's JSON-LD walk: real recipe pages nest a few levels and a
// few hundred nodes; anything far beyond that is not worth the time.
const MAX_DEPTH = 10;
const MAX_VISITS = 5000;

const isRecipeType = (type: unknown): boolean =>
  type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));

const findRecipeNode = (jsonLd: readonly unknown[]): RecipeNode | undefined => {
  let visits = 0;
  const walk = (value: unknown, depth: number): RecipeNode | undefined => {
    visits += 1;
    if (depth > MAX_DEPTH || visits > MAX_VISITS) {
      return undefined;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(item, depth + 1);
        if (found !== undefined || visits > MAX_VISITS) {
          return found;
        }
      }
      return undefined;
    }
    if (!isRecord(value)) {
      return undefined;
    }
    if (isRecipeType(value["@type"])) {
      return value;
    }
    return (
      walk(value["@graph"], depth + 1) ?? walk(value.mainEntity, depth + 1)
    );
  };
  return walk(jsonLd, 0);
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const decodeEntity = (match: string, body: string): string => {
  if (body.startsWith("#x") || body.startsWith("#X")) {
    const code = Number.parseInt(body.slice(2), 16);
    return Number.isNaN(code) ? match : String.fromCodePoint(code);
  }
  if (body.startsWith("#")) {
    const code = Number.parseInt(body.slice(1), 10);
    return Number.isNaN(code) ? match : String.fromCodePoint(code);
  }
  return ENTITIES[body] ?? match;
};

// Display hygiene only: everything is rendered as React text, never HTML.
const cleanText = (text: string): string =>
  text
    .replaceAll(/<[^>]*>/g, " ")
    .replaceAll(
      /&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]+);/gi,
      (match, body: string) => {
        try {
          return decodeEntity(match, body);
        } catch {
          // `fromCodePoint` throws on out-of-range code points.
          return match;
        }
      }
    )
    .replaceAll(/\s+/g, " ")
    // A stripped tag right before punctuation leaves "kerma ." behind.
    .replaceAll(/ ([.,;:!?])/g, "$1")
    .trim();

const cleanList = (values: readonly string[]): string[] =>
  values.map(cleanText).filter((text) => text !== "");

// Some sites give `recipeIngredient` as one newline-separated string.
const readStrings = (value: unknown): string[] => {
  if (typeof value === "string") {
    return value.split(/\r?\n/);
  }
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
};

// recipeInstructions: a string, HowToStep[], or HowToSection[] whose
// `itemListElement` holds the steps (and, rarely, more sections).
const readInstructions = (value: unknown, depth = 0): string[] => {
  if (depth > MAX_DEPTH) {
    return [];
  }
  if (typeof value === "string") {
    return value.split(/\r?\n/);
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => readInstructions(item, depth + 1));
  }
  if (!isRecord(value)) {
    return [];
  }
  if (value.itemListElement !== undefined) {
    return readInstructions(value.itemListElement, depth + 1);
  }
  if (typeof value.text === "string") {
    return [value.text];
  }
  return typeof value.name === "string" ? [value.name] : [];
};

const readRecipeNode = (node: RecipeNode): SchemaRecipe => {
  const recipe: SchemaRecipe = {
    ingredients: cleanList(readStrings(node.recipeIngredient)),
    instructions: cleanList(readInstructions(node.recipeInstructions)),
  };
  const title = typeof node.name === "string" ? cleanText(node.name) : "";
  if (title !== "") {
    recipe.title = title;
  }
  const servings = parseServings(node.recipeYield);
  if (servings !== undefined) {
    recipe.servings = servings;
  }
  const nutrition = fromSchemaNutrition(node.nutrition);
  if (nutrition !== undefined) {
    recipe.nutrition = nutrition;
  }
  if (typeof node.inLanguage === "string" && node.inLanguage.trim() !== "") {
    recipe.language = node.inLanguage.trim().toLowerCase();
  }
  return recipe;
};

export { cleanText, findRecipeNode, readRecipeNode };
