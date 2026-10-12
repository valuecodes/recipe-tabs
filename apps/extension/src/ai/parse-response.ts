import { isFiniteNumber, isRecord, isString } from "~/lib/guards";

// Model output is untrusted text: parse it, keep the items that fit, and turn
// everything else into a warning. Never throws.
type ModelIngredient = { name: string; quantity?: number; unit?: string };
type IndexedIngredient = ModelIngredient & { index: number };
type TextIngredient = ModelIngredient & { text: string };

type Parsed<T> = { items: T[]; warning?: string };

const NOT_JSON = "The AI's answer was not valid JSON";
const WRONG_SHAPE = "The AI's answer was not in the expected shape";

const readList = (raw: string): unknown[] | string => {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return NOT_JSON;
  }
  return isRecord(value) && Array.isArray(value.ingredients)
    ? value.ingredients
    : WRONG_SHAPE;
};

const readFields = (
  item: Record<string, unknown>
): ModelIngredient | undefined => {
  const name = isString(item.name) ? item.name.trim() : "";
  if (name === "") {
    return undefined;
  }
  const fields: ModelIngredient = { name };
  if (item.quantity !== undefined) {
    if (!isFiniteNumber(item.quantity) || item.quantity < 0) {
      return undefined;
    }
    fields.quantity = item.quantity;
  }
  if (isString(item.unit) && item.unit.trim() !== "") {
    fields.unit = item.unit.trim();
  }
  return fields;
};

const withWarning = <T>(items: T[], total: number): Parsed<T> =>
  items.length === total
    ? { items }
    : {
        items,
        warning: `Ignored ${total - items.length} unusable item(s) in the AI's answer`,
      };

// Indexes are recipe-wide; only the batch's own range [start, end] is
// accepted, and a repeated index keeps its first item.
const parseIndexedIngredients = (
  raw: string,
  start: number,
  end: number
): Parsed<IndexedIngredient> => {
  const list = readList(raw);
  if (isString(list)) {
    return { items: [], warning: list };
  }
  const seen = new Set<number>();
  const items: IndexedIngredient[] = [];
  for (const item of list) {
    if (!isRecord(item)) {
      continue;
    }
    const { index } = item;
    const fields = readFields(item);
    if (
      fields !== undefined &&
      isFiniteNumber(index) &&
      Number.isInteger(index) &&
      index >= start &&
      index <= end &&
      !seen.has(index)
    ) {
      seen.add(index);
      items.push({ ...fields, index });
    }
  }
  return withWarning(items, list.length);
};

const parseTextIngredients = (raw: string): Parsed<TextIngredient> => {
  const list = readList(raw);
  if (isString(list)) {
    return { items: [], warning: list };
  }
  const items: TextIngredient[] = [];
  for (const item of list) {
    if (!isRecord(item)) {
      continue;
    }
    const text = isString(item.text) ? item.text.trim() : "";
    const fields = readFields(item);
    if (fields !== undefined && text !== "") {
      items.push({ ...fields, text });
    }
  }
  return withWarning(items, list.length);
};

export type { IndexedIngredient, TextIngredient };
export { parseIndexedIngredients, parseTextIngredients };
