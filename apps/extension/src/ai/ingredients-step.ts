import { detectLanguage, translateLines } from "~/ai/language";
import {
  parseIndexedIngredients,
  parseTextIngredients,
} from "~/ai/parse-response";
import type { IndexedIngredient, TextIngredient } from "~/ai/parse-response";
import { ingredientLinesPrompt, ingredientTextPrompt } from "~/ai/prompts";
import type { PromptRequest } from "~/ai/prompts";
import { isQuotaError, withTask } from "~/ai/session";
import type { Ingredient, Recipe } from "~/lib/recipe";
import { findIngredientWindow, normalizeForMatch } from "~/lib/text-recipe";

// The ingredients step: detect the language, translate Finnish to English,
// then ask Gemini Nano for name / quantity / unit per ingredient line.
type IngredientsResult = {
  language: string;
  titleEn?: string;
  ingredients: Ingredient[];
  method?: "ai";
  warnings: string[];
};

type StepContext = {
  // Lazy: creating the base session loads the model, so a step that never
  // prompts (no text, unsupported language) never pays for it.
  base: () => Promise<LanguageModel>;
  signal: AbortSignal;
  warnings: string[];
};

// A page-text line and what the model sees: its translation, or itself.
type SourceLine = { source: string; english: string };

const BATCH_SIZE = 40;
const SAMPLE_LINES = 5;
const SAMPLE_CHARS = 300;
const SHORT_WINDOW = 2000;

const NO_SOURCE = "No ingredient text to read";
const READ_FROM_TEXT =
  "Ingredients were read by the on-device AI from the page text";
const NO_HEADING = "No ingredients heading found on the page";
const SUPPORTED_LANGUAGES =
  "the on-device AI supports English, and Finnish through translation";

// The session is English-only (see RECIPE_SESSION_OPTIONS): any language
// other than English and Finnish, including an undetermined one, is never
// sent to the model.
const unsupportedLanguage = (language: string): string =>
  language === "und"
    ? `Ingredients were not read: the language could not be determined, and ${SUPPORTED_LANGUAGES}`
    : `Ingredients in "${language}" were not read: ${SUPPORTED_LANGUAGES}`;

const ask = async (
  context: StepContext,
  request: PromptRequest
): Promise<string> =>
  withTask(await context.base(), context.signal, (session) =>
    session.prompt(request.input, {
      responseConstraint: request.responseConstraint,
      signal: context.signal,
    })
  );

// A batch that does not fit the context is split in half until it does; a
// single line that still does not fit is skipped with a warning.
const promptBatch = async (
  context: StepContext,
  lines: readonly string[],
  offset: number
): Promise<IndexedIngredient[]> => {
  try {
    const raw = await ask(context, ingredientLinesPrompt(lines, offset));
    const parsed = parseIndexedIngredients(
      raw,
      offset + 1,
      offset + lines.length
    );
    if (parsed.warning !== undefined) {
      context.warnings.push(parsed.warning);
    }
    return parsed.items;
  } catch (error) {
    if (!isQuotaError(error)) {
      throw error;
    }
    if (lines.length === 1) {
      context.warnings.push(
        `Ingredient line ${offset + 1} was too long for the AI`
      );
      return [];
    }
    const half = Math.ceil(lines.length / 2);
    const first = await promptBatch(context, lines.slice(0, half), offset);
    const second = await promptBatch(context, lines.slice(half), offset + half);
    return [...first, ...second];
  }
};

const readLines = async (
  context: StepContext,
  recipe: Recipe,
  english: readonly string[] | undefined
): Promise<Ingredient[]> => {
  const lines = english ?? recipe.ingredients.map(({ rawText }) => rawText);
  const items: IndexedIngredient[] = [];
  for (let offset = 0; offset < lines.length; offset += BATCH_SIZE) {
    items.push(
      ...(await promptBatch(
        context,
        lines.slice(offset, offset + BATCH_SIZE),
        offset
      ))
    );
  }
  if (items.length === 0) {
    throw new Error(context.warnings[0] ?? "The AI returned no ingredients");
  }
  const byIndex = new Map(items.map((item) => [item.index, item]));
  return recipe.ingredients.map(({ rawText }, index): Ingredient => {
    const ingredient: Ingredient = { rawText };
    const translated = english?.[index];
    if (translated !== undefined) {
      ingredient.rawTextEn = translated;
    }
    const item = byIndex.get(index + 1);
    if (item !== undefined) {
      ingredient.name = item.name;
      if (item.quantity !== undefined) {
        ingredient.quantity = item.quantity;
      }
      if (item.unit !== undefined) {
        ingredient.unit = item.unit;
      }
    }
    return ingredient;
  });
};

const toIngredient = (
  item: TextIngredient,
  line: SourceLine,
  translated: boolean
): Ingredient => {
  const ingredient: Ingredient = { rawText: line.source, name: item.name };
  if (translated) {
    ingredient.rawTextEn = line.english;
  }
  if (item.quantity !== undefined) {
    ingredient.quantity = item.quantity;
  }
  if (item.unit !== undefined) {
    ingredient.unit = item.unit;
  }
  return ingredient;
};

// Maps each item to the prompted line its `text` quotes, each line once, so an
// invented line is never stored as if the page said it, and the stored
// `rawText` is the page's own (untranslated) line.
const matchQuoted = (
  context: StepContext,
  items: readonly TextIngredient[],
  lines: readonly SourceLine[],
  translated: boolean
): Ingredient[] => {
  const normalized = lines.map(({ english }) => normalizeForMatch(english));
  const used = new Set<number>();
  const ingredients: Ingredient[] = [];
  for (const item of items) {
    const text = normalizeForMatch(item.text);
    const index = normalized.findIndex(
      (line, lineIndex) => !used.has(lineIndex) && line.includes(text)
    );
    const line = lines[index];
    if (text !== "" && line !== undefined) {
      used.add(index);
      ingredients.push(toIngredient(item, line, translated));
    }
  }
  if (ingredients.length < items.length) {
    context.warnings.push(
      `Ignored ${items.length - ingredients.length} ingredient(s) the AI did not quote from the page`
    );
  }
  return ingredients;
};

// The leading lines that fit in `maxChars` (at least one).
const linesUpTo = (
  lines: readonly SourceLine[],
  maxChars: number
): SourceLine[] => {
  const kept: SourceLine[] = [];
  let total = 0;
  for (const line of lines) {
    total += line.english.length + 1;
    if (total > maxChars && kept.length > 0) {
      break;
    }
    kept.push(line);
  }
  return kept;
};

const promptText = (
  context: StepContext,
  lines: readonly SourceLine[]
): Promise<string> =>
  ask(
    context,
    ingredientTextPrompt(lines.map(({ english }) => english).join("\n"))
  );

const readText = async (
  context: StepContext,
  lines: readonly SourceLine[],
  translated: boolean
): Promise<Ingredient[]> => {
  let prompted = lines;
  let raw: string;
  try {
    raw = await promptText(context, prompted);
  } catch (error) {
    if (!isQuotaError(error)) {
      throw error;
    }
    prompted = linesUpTo(lines, SHORT_WINDOW);
    try {
      raw = await promptText(context, prompted);
    } catch (retryError) {
      if (!isQuotaError(retryError)) {
        throw retryError;
      }
      throw new Error("The page text was too long for the AI", {
        cause: retryError,
      });
    }
  }
  const parsed = parseTextIngredients(raw);
  if (parsed.warning !== undefined) {
    context.warnings.push(parsed.warning);
  }
  const ingredients = matchQuoted(context, parsed.items, prompted, translated);
  if (ingredients.length === 0) {
    throw new Error(
      context.warnings[0] ?? "The AI found no ingredients in the page text"
    );
  }
  return ingredients;
};

const runIngredientsStep = async (
  recipe: Recipe,
  base: () => Promise<LanguageModel>,
  signal: AbortSignal
): Promise<IngredientsResult> => {
  const fromJsonLd = recipe.ingredients.length > 0;
  const pageText = recipe.pageText ?? "";
  if (!fromJsonLd && pageText.trim() === "") {
    return {
      language: recipe.language,
      ingredients: recipe.ingredients,
      warnings: [NO_SOURCE],
    };
  }
  const window = fromJsonLd ? undefined : findIngredientWindow(pageText);
  const sample = [
    recipe.title,
    ...(window === undefined
      ? recipe.ingredients.slice(0, SAMPLE_LINES).map(({ rawText }) => rawText)
      : [window.text.slice(0, SAMPLE_CHARS)]),
  ].join("\n");
  const { language } = await detectLanguage(sample, recipe.language, signal);
  if (language !== "en" && language !== "fi") {
    return {
      language,
      ingredients: recipe.ingredients,
      warnings: [unsupportedLanguage(language)],
    };
  }
  const context: StepContext = { base, signal, warnings: [] };
  const result: IngredientsResult = {
    language,
    ingredients: [],
    warnings: context.warnings,
  };
  const finnish = language === "fi";
  if (finnish) {
    const [titleEn] = await translateLines([recipe.title], signal);
    if (titleEn !== undefined) {
      result.titleEn = titleEn;
    }
  }
  if (window === undefined) {
    const english = finnish
      ? await translateLines(
          recipe.ingredients.map(({ rawText }) => rawText),
          signal
        )
      : undefined;
    result.ingredients = await readLines(context, recipe, english);
    return result;
  }
  const sources = window.text.split("\n").filter((line) => line.trim() !== "");
  const english = finnish ? await translateLines(sources, signal) : sources;
  const lines = sources.map((source, index): SourceLine => ({
    source,
    english: english[index] ?? source,
  }));
  result.ingredients = await readText(context, lines, finnish);
  result.method = "ai";
  context.warnings.unshift(READ_FROM_TEXT);
  if (!window.foundHeading) {
    context.warnings.push(NO_HEADING);
  }
  return result;
};

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

// Applied to the freshly stored recipe inside the repository lock.
const applyIngredientsResult = (
  recipe: Recipe,
  result: IngredientsResult
): Recipe => {
  const next: Recipe = {
    ...recipe,
    language: result.language,
    ingredients: result.ingredients,
    extraction: {
      method: result.method ?? recipe.extraction.method,
      warnings: unique([...recipe.extraction.warnings, ...result.warnings]),
    },
    enrichment: {
      ...recipe.enrichment,
      completed: unique([...recipe.enrichment.completed, "ingredients"]),
    },
  };
  if (result.titleEn !== undefined) {
    next.titleEn = result.titleEn;
  }
  return next;
};

export { applyIngredientsResult, runIngredientsStep };
