// Narrowing helpers for values that arrive as `unknown`: JSON-LD, storage
// reads and `executeScript` results.
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isOptional = <T>(
  value: unknown,
  guard: (item: unknown) => item is T
): value is T | undefined => value === undefined || guard(value);

const isString = (value: unknown): value is string => typeof value === "string";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export { isFiniteNumber, isOptional, isRecord, isString, isStringArray };
