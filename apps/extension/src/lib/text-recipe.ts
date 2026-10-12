// Page-text helpers for recipes without JSON-LD ingredients.
type IngredientWindow = { text: string; foundHeading: boolean };

// A line that is only an ingredients heading, in English or Finnish.
const HEADING =
  /^[ \t]*(?:ingredients|ainekset|ainesosat|raaka-aineet)[ \t]*:?[ \t]*$/im;

const DEFAULT_WINDOW = 4000;

// The model's context is small: send the part of the page that most likely
// holds the ingredient list, starting at its heading when there is one.
const findIngredientWindow = (
  pageText: string,
  size = DEFAULT_WINDOW
): IngredientWindow => {
  const heading = HEADING.exec(pageText);
  return heading === null
    ? { text: pageText.slice(0, size), foundHeading: false }
    : {
        text: pageText.slice(heading.index, heading.index + size),
        foundHeading: true,
      };
};

// Lower-cased with whitespace collapsed, for checking that model output
// quotes the text it was given.
const normalizeForMatch = (text: string): string =>
  text.toLowerCase().replaceAll(/\s+/g, " ").trim();

export { findIngredientWindow, normalizeForMatch };
