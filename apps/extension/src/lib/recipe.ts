import {
  isFiniteNumber,
  isOptional,
  isRecord,
  isString,
  isStringArray,
} from "~/lib/guards";
import type { NutrientValue, Nutrition } from "~/lib/nutrition";
import type { PageCapture } from "~/lib/page-capture";
import { cleanText, findRecipeNode, readRecipeNode } from "~/lib/schema-org";
import { normalizeRecipeUrl } from "~/lib/url";

type Ingredient = {
  rawText: string;
  rawTextEn?: string;
  name?: string;
  quantity?: number;
  unit?: string;
};

type EnrichStep = "ingredients" | "classification" | "nutrition";

type EnrichmentStatus = "pending" | "running" | "done" | "failed";

type Classification = {
  dish: string;
  category: string;
  cuisine?: string;
  source: "ai";
};

type Recipe = {
  id: string;
  url: string;
  title: string;
  titleEn?: string;
  language: string;
  servings?: number;
  ingredients: Ingredient[];
  instructions: string[];
  nutrition?: Nutrition;
  classification?: Classification;
  extraction: { method: "jsonld" | "text" | "ai"; warnings: string[] };
  // The capped page text, kept only when JSON-LD gave no ingredients, so the
  // AI ingredient step can run after the tab is gone.
  pageText?: string;
  enrichment: {
    status: EnrichmentStatus;
    runId?: string;
    completed: EnrichStep[];
    error?: string;
  };
  savedAt: number;
};

const NO_STRUCTURED_DATA = "No structured recipe data on this page";

const recipeFromCapture = (
  capture: PageCapture,
  now: number
): Recipe | undefined => {
  const id = normalizeRecipeUrl(capture.url);
  if (id === undefined) {
    return undefined;
  }
  const node = findRecipeNode(capture.jsonLd);
  const schema = node === undefined ? undefined : readRecipeNode(node);
  const pageTitle = cleanText(capture.title);
  const documentLanguage = capture.documentLanguage.trim().toLowerCase();
  const language =
    schema?.language ?? (documentLanguage === "" ? "und" : documentLanguage);
  const ingredients = (schema?.ingredients ?? []).map(
    (rawText): Ingredient => ({ rawText })
  );
  const recipe: Recipe = {
    id,
    url: capture.url,
    title: schema?.title ?? (pageTitle === "" ? id : pageTitle),
    language,
    ingredients,
    instructions: schema?.instructions ?? [],
    extraction: {
      method: schema === undefined ? "text" : "jsonld",
      warnings: schema === undefined ? [NO_STRUCTURED_DATA] : [],
    },
    enrichment: { status: "pending", completed: [] },
    savedAt: now,
  };
  if (schema?.servings !== undefined) {
    recipe.servings = schema.servings;
  }
  if (schema?.nutrition !== undefined) {
    recipe.nutrition = schema.nutrition;
  }
  if (ingredients.length === 0) {
    recipe.pageText = capture.text;
  }
  return recipe;
};

// Every step any build knows about, so data written by a newer build still
// validates. The steps this build runs are `ENRICH_STEPS` in lib/enrichment.ts.
const KNOWN_STEPS: readonly unknown[] = [
  "ingredients",
  "classification",
  "nutrition",
];
const STATUSES: readonly unknown[] = ["pending", "running", "done", "failed"];
const METHODS: readonly unknown[] = ["jsonld", "text", "ai"];
const BASES: readonly unknown[] = ["per-serving", "unknown"];
const SOURCES: readonly unknown[] = ["site", "ai-estimate"];

const isIngredient = (value: unknown): value is Ingredient =>
  isRecord(value) &&
  isString(value.rawText) &&
  isOptional(value.rawTextEn, isString) &&
  isOptional(value.name, isString) &&
  isOptional(value.quantity, isFiniteNumber) &&
  isOptional(value.unit, isString);

const isNutrientValue = (value: unknown): value is NutrientValue =>
  isRecord(value) &&
  isFiniteNumber(value.value) &&
  BASES.includes(value.basis) &&
  SOURCES.includes(value.source);

const isNutrition = (value: unknown): value is Nutrition =>
  isRecord(value) &&
  isOptional(value.kcal, isNutrientValue) &&
  isOptional(value.sugarG, isNutrientValue) &&
  isOptional(value.fatG, isNutrientValue);

const isClassification = (value: unknown): value is Classification =>
  isRecord(value) &&
  isString(value.dish) &&
  isString(value.category) &&
  isOptional(value.cuisine, isString) &&
  value.source === "ai";

const isExtraction = (value: unknown): value is Recipe["extraction"] =>
  isRecord(value) &&
  METHODS.includes(value.method) &&
  isStringArray(value.warnings);

const isEnrichment = (value: unknown): value is Recipe["enrichment"] =>
  isRecord(value) &&
  STATUSES.includes(value.status) &&
  Array.isArray(value.completed) &&
  value.completed.every((step) => KNOWN_STEPS.includes(step)) &&
  isOptional(value.runId, isString) &&
  isOptional(value.error, isString);

const isPositiveNumber = (value: unknown): value is number =>
  isFiniteNumber(value) && value > 0;

// Finite is not enough: `new Date(1e100)` is an Invalid Date and formatting
// it throws, which would take the whole library list down.
const isTimestamp = (value: unknown): value is number =>
  isFiniteNumber(value) && !Number.isNaN(new Date(value).getTime());

// Storage reads are `unknown`: validate every field a consumer reads, so one
// malformed entry is skipped instead of crashing a page.
const isRecipe = (value: unknown): value is Recipe =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.url) &&
  isString(value.title) &&
  isOptional(value.titleEn, isString) &&
  isString(value.language) &&
  isOptional(value.servings, isPositiveNumber) &&
  Array.isArray(value.ingredients) &&
  value.ingredients.every(isIngredient) &&
  isStringArray(value.instructions) &&
  isOptional(value.nutrition, isNutrition) &&
  isOptional(value.classification, isClassification) &&
  isExtraction(value.extraction) &&
  isOptional(value.pageText, isString) &&
  isEnrichment(value.enrichment) &&
  isTimestamp(value.savedAt);

export type { Classification, EnrichStep, Ingredient, Recipe };
export { isRecipe, NO_STRUCTURED_DATA, recipeFromCapture };
