// schema.org `recipeYield` is free-form: "4 annosta", "Serves 4", 4, or an
// array such as ["4", "4 servings"]. The first positive integer wins.
const fromString = (text: string): number | undefined => {
  const match = /\d+/.exec(text);
  if (match === null) {
    return undefined;
  }
  const value = Number.parseInt(match[0], 10);
  return value > 0 ? value : undefined;
};

const parseServings = (yieldValue: unknown): number | undefined => {
  if (typeof yieldValue === "number") {
    return Number.isInteger(yieldValue) && yieldValue > 0
      ? yieldValue
      : undefined;
  }
  if (typeof yieldValue === "string") {
    return fromString(yieldValue);
  }
  if (Array.isArray(yieldValue)) {
    for (const item of yieldValue) {
      const value = parseServings(item);
      if (value !== undefined) {
        return value;
      }
    }
  }
  return undefined;
};

export { parseServings };
