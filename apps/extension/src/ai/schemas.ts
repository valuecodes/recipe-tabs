// JSON schemas for `prompt(..., { responseConstraint })`. The schema costs
// context tokens, so they stay tiny: no descriptions, the shape is in prose.
const INGREDIENT_FIELDS = {
  name: { type: "string" },
  quantity: { type: "number" },
  unit: { type: "string" },
} as const;

// One item per numbered input line, matched back by `index`.
const INDEXED_INGREDIENTS_SCHEMA = {
  type: "object",
  properties: {
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: { index: { type: "integer" }, ...INGREDIENT_FIELDS },
        required: ["index", "name"],
        additionalProperties: false,
      },
    },
  },
  required: ["ingredients"],
  additionalProperties: false,
} as const;

// Ingredients found in free page text; `text` quotes the source line.
const TEXT_INGREDIENTS_SCHEMA = {
  type: "object",
  properties: {
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: { text: { type: "string" }, ...INGREDIENT_FIELDS },
        required: ["text", "name"],
        additionalProperties: false,
      },
    },
  },
  required: ["ingredients"],
  additionalProperties: false,
} as const;

export { INDEXED_INGREDIENTS_SCHEMA, TEXT_INGREDIENTS_SCHEMA };
