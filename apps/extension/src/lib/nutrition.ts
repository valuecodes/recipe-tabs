import { isRecord } from "~/lib/guards";

// Nutrition values carry their own basis and source, so a recipe can mix a
// site value with an AI estimate (PR E) without one label lying about another.
type NutrientValue = {
  value: number;
  basis: "per-serving" | "unknown";
  source: "site" | "ai-estimate";
};

type Nutrition = {
  kcal?: NutrientValue;
  sugarG?: NutrientValue;
  fatG?: NutrientValue;
};

type Amount = { value: number; unit?: string };

const KJ_PER_KCAL = 4.184;

// "412 kcal", "12,5 g", "1 234 kcal", 7. The whole value must be a number and
// an optional unit: "1/2 g" or "12 g sugar" are rejected, never read as 1 or
// 12. `\s` also matches the no-break space some sites use between thousands.
const parseAmount = (value: unknown): Amount | undefined => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? { value } : undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const match = /^\s*(\d[\d\s]*(?:[.,]\d+)?)\s*([a-zA-Z]*)\s*$/.exec(value);
  if (match === null) {
    return undefined;
  }
  const digits = (match[1] ?? "").replaceAll(/\s/g, "").replace(",", ".");
  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  const unit = (match[2] ?? "").toLowerCase();
  return unit === "" ? { value: parsed } : { value: parsed, unit };
};

// Accepted units per nutrient, as converters to the stored unit; a missing
// unit is taken as the stored one. Anything else is dropped, not mislabelled.
const KCAL_UNITS: Record<string, (value: number) => number> = {
  kcal: (value) => value,
  cal: (value) => value,
  calories: (value) => value,
  kj: (value) => Math.round(value / KJ_PER_KCAL),
};

const GRAM_UNITS: Record<string, (value: number) => number> = {
  g: (value) => value,
  grams: (value) => value,
  mg: (value) => value / 1000,
};

const converter =
  (units: Record<string, (value: number) => number>) =>
  (amount: Amount): number | undefined => {
    if (amount.unit === undefined) {
      return amount.value;
    }
    const convert = Object.hasOwn(units, amount.unit)
      ? units[amount.unit]
      : undefined;
    return convert === undefined ? undefined : convert(amount.value);
  };

const toKcal = converter(KCAL_UNITS);
const toGrams = converter(GRAM_UNITS);

// Only explicit evidence makes a site value per serving: the words serving or
// portion, or Finnish annos / annoksen / annoksessa. "100 g" or a missing
// servingSize stays unknown and is never compared as per serving.
const basisOf = (servingSize: unknown): NutrientValue["basis"] =>
  typeof servingSize === "string" &&
  /\b(servings?|portions?|annos\w*|annoks\w*)\b/i.test(servingSize)
    ? "per-serving"
    : "unknown";

const fromSchemaNutrition = (node: unknown): Nutrition | undefined => {
  if (!isRecord(node)) {
    return undefined;
  }
  const basis = basisOf(node.servingSize);
  const read = (
    field: unknown,
    convert: (amount: Amount) => number | undefined
  ): NutrientValue | undefined => {
    const amount = parseAmount(field);
    const value = amount === undefined ? undefined : convert(amount);
    return value === undefined ? undefined : { value, basis, source: "site" };
  };
  const nutrition: Nutrition = {};
  const kcal = read(node.calories, toKcal);
  const sugarG = read(node.sugarContent, toGrams);
  const fatG = read(node.fatContent, toGrams);
  if (kcal !== undefined) {
    nutrition.kcal = kcal;
  }
  if (sugarG !== undefined) {
    nutrition.sugarG = sugarG;
  }
  if (fatG !== undefined) {
    nutrition.fatG = fatG;
  }
  return Object.keys(nutrition).length > 0 ? nutrition : undefined;
};

export type { NutrientValue, Nutrition };
export { fromSchemaNutrition, parseAmount };
