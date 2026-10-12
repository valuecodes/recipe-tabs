// A deterministic ingredient-line parser. It is the baseline the side panel
// shows next to Gemini Nano's result, so the two can be compared.
type ParsedIngredient = { quantity?: number; unit?: string; name: string };

const FRACTIONS: Record<string, number> = {
  "½": 1 / 2,
  "¼": 1 / 4,
  "¾": 3 / 4,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
};

// Finnish and English kitchen units; plurals map to the singular. A Map, so a
// page word like "constructor" never hits `Object.prototype`.
const UNITS = new Map<string, string>([
  ["dl", "dl"],
  ["l", "l"],
  ["ml", "ml"],
  ["cl", "cl"],
  ["g", "g"],
  ["kg", "kg"],
  ["tl", "tl"],
  ["rkl", "rkl"],
  ["kpl", "kpl"],
  ["prk", "prk"],
  ["pss", "pss"],
  ["cup", "cup"],
  ["cups", "cup"],
  ["tbsp", "tbsp"],
  ["tsp", "tsp"],
  ["oz", "oz"],
  ["lb", "lb"],
  ["lbs", "lb"],
]);

const toNumber = (text: string): number => Number(text.replace(",", "."));

type QuantityMatch = { value: number; length: number };

const readQuantity = (text: string): QuantityMatch | undefined => {
  const mixed = /^(\d+)\s+(\d+)\/(\d+)/.exec(text);
  if (mixed !== null && Number(mixed[3]) > 0) {
    return {
      value: Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]),
      length: mixed[0].length,
    };
  }
  const fraction = /^(\d+)\/(\d+)/.exec(text);
  if (fraction !== null && Number(fraction[2]) > 0) {
    return {
      value: Number(fraction[1]) / Number(fraction[2]),
      length: fraction[0].length,
    };
  }
  const vulgar = /^(\d+)?\s*([½¼¾⅓⅔])/.exec(text);
  if (vulgar !== null) {
    const whole = vulgar[1] === undefined ? 0 : Number(vulgar[1]);
    return {
      value: whole + (FRACTIONS[vulgar[2] ?? ""] ?? 0),
      length: vulgar[0].length,
    };
  }
  const decimal = /^\d+(?:[.,]\d+)?/.exec(text);
  if (decimal !== null) {
    return { value: toNumber(decimal[0]), length: decimal[0].length };
  }
  return undefined;
};

// "2-3 tbsp": keep the first value, drop the upper bound.
const RANGE_END = /^\s*[-–]\s*(?:\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔])/;

const UNIT_WORD = /^\s*([a-z]+)\.?(?=\s|$)/i;

const parseIngredientLine = (line: string): ParsedIngredient => {
  const text = line.trim();
  const quantity = readQuantity(text);
  if (quantity === undefined) {
    return { name: text };
  }
  let rest = text.slice(quantity.length);
  const range = RANGE_END.exec(rest);
  if (range !== null) {
    rest = rest.slice(range[0].length);
  }
  const parsed: ParsedIngredient = { quantity: quantity.value, name: "" };
  const unitWord = UNIT_WORD.exec(rest);
  const unit =
    unitWord === null
      ? undefined
      : UNITS.get((unitWord[1] ?? "").toLowerCase());
  if (unitWord !== null && unit !== undefined) {
    parsed.unit = unit;
    rest = rest.slice(unitWord[0].length);
  }
  parsed.name = rest.trim();
  return parsed;
};

export { parseIngredientLine };
