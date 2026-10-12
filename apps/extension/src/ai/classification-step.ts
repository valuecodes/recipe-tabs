import { parseClassification } from "~/ai/parse-response";
import { classificationPrompt } from "~/ai/prompts";
import { askJson, isQuotaError } from "~/ai/session";
import type { Classification, Recipe } from "~/lib/recipe";

// The classification step: dish, category and cuisine from the English title
// and ingredient names. Runs after the ingredients step, which supplies the
// names and, for Finnish recipes, the translations.
type ClassificationResult = {
  classification?: Classification;
  warnings: string[];
};

const MAX_NAMES = 40;
const SHORT_NAMES = 15;

const NOT_CLASSIFIED =
  "Not classified: the on-device AI supports English, and Finnish through translation";

// Only English text reaches the model: a Finnish recipe needs its translated
// title, and an untranslated line is used only when the recipe is English.
const englishInput = (
  recipe: Recipe
): { title: string; names: string[] } | undefined => {
  const english = recipe.language === "en";
  if (!english && (recipe.language !== "fi" || recipe.titleEn === undefined)) {
    return undefined;
  }
  const names = recipe.ingredients
    .map(
      ({ name, rawTextEn, rawText }) =>
        name ?? rawTextEn ?? (english ? rawText : undefined)
    )
    .filter((name): name is string => name !== undefined && name.trim() !== "")
    .slice(0, MAX_NAMES);
  return { title: recipe.titleEn ?? recipe.title, names };
};

const runClassificationStep = async (
  recipe: Recipe,
  base: () => Promise<LanguageModel>,
  signal: AbortSignal
): Promise<ClassificationResult> => {
  const input = englishInput(recipe);
  if (input === undefined) {
    return { warnings: [NOT_CLASSIFIED] };
  }
  const ask = async (names: readonly string[]): Promise<string> =>
    askJson(await base(), signal, classificationPrompt(input.title, names));
  let raw: string;
  try {
    raw = await ask(input.names);
  } catch (error) {
    if (!isQuotaError(error)) {
      throw error;
    }
    try {
      raw = await ask(input.names.slice(0, SHORT_NAMES));
    } catch (retryError) {
      if (!isQuotaError(retryError)) {
        throw retryError;
      }
      throw new Error("The recipe was too long for the AI to classify", {
        cause: retryError,
      });
    }
  }
  const parsed = parseClassification(raw);
  if (parsed.classification === undefined) {
    throw new Error(parsed.warning ?? "The AI did not classify the recipe");
  }
  return {
    classification: { ...parsed.classification, source: "ai" },
    warnings: [],
  };
};

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

// Applied to the freshly stored recipe inside the repository lock.
const applyClassificationResult = (
  recipe: Recipe,
  result: ClassificationResult
): Recipe => {
  const next: Recipe = {
    ...recipe,
    extraction: {
      ...recipe.extraction,
      warnings: unique([...recipe.extraction.warnings, ...result.warnings]),
    },
    enrichment: {
      ...recipe.enrichment,
      completed: unique([...recipe.enrichment.completed, "classification"]),
    },
  };
  if (result.classification !== undefined) {
    next.classification = result.classification;
  }
  return next;
};

export { applyClassificationResult, runClassificationStep };
