import { enrichmentLabel } from "~/lib/enrichment";
import { parseIngredientLine } from "~/lib/ingredient";
import type { NutrientValue } from "~/lib/nutrition";
import type { Ingredient, Recipe } from "~/lib/recipe";
import { isHttpUrl } from "~/lib/url";

// Everything here comes from a web page: rendered as React text only, and the
// host is shown only for http(s) URLs.
const hostOf = (url: string): string | undefined =>
  isHttpUrl(url) ? new URL(url).host : undefined;

const NutrientRow = ({
  label,
  unit,
  nutrient,
}: {
  label: string;
  unit: string;
  nutrient: NutrientValue | undefined;
}) =>
  nutrient === undefined ? null : (
    <li>
      {label}: {nutrient.value} {unit}
      {nutrient.basis === "unknown" ? " (unknown basis)" : " per serving"}
    </li>
  );

const numberFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

const formatAmount = (
  quantity: number | undefined,
  unit: string | undefined,
  name: string
): string =>
  [
    quantity === undefined ? "" : numberFormat.format(quantity),
    unit ?? "",
    name,
  ]
    .filter((part) => part !== "")
    .join(" ");

// The original line (and its English translation), Gemini Nano's reading and
// the deterministic parser's, side by side so the two can be compared.
const IngredientRow = ({ ingredient }: { ingredient: Ingredient }) => {
  const parsed = parseIngredientLine(ingredient.rawText);
  return (
    <tr className="align-top">
      <td className="py-0.5 pr-2">
        {ingredient.rawText}
        {ingredient.rawTextEn === undefined ? null : (
          <span className="block text-zinc-500">{ingredient.rawTextEn}</span>
        )}
      </td>
      <td className="py-0.5 pr-2">
        {ingredient.name === undefined
          ? "—"
          : formatAmount(ingredient.quantity, ingredient.unit, ingredient.name)}
      </td>
      <td className="py-0.5 text-zinc-500">
        {formatAmount(parsed.quantity, parsed.unit, parsed.name)}
      </td>
    </tr>
  );
};

const RecipeCard = ({ recipe, saved }: { recipe: Recipe; saved: boolean }) => {
  const host = hostOf(recipe.url);
  const translated =
    recipe.titleEn !== undefined ||
    recipe.ingredients.some(({ rawTextEn }) => rawTextEn !== undefined);
  return (
    <article className="mt-4 rounded border border-zinc-200 p-3 dark:border-zinc-700">
      <h2 className="font-semibold">{recipe.title}</h2>
      {recipe.titleEn === undefined ? null : (
        <p className="text-zinc-500">{recipe.titleEn}</p>
      )}
      {saved ? (
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          {enrichmentLabel(recipe)}
        </p>
      ) : null}
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-zinc-700 dark:text-zinc-300">
        {host === undefined ? null : (
          <>
            <dt>Site</dt>
            <dd>{host}</dd>
          </>
        )}
        <dt>Language</dt>
        <dd>
          {recipe.language}
          {translated ? " · translated" : ""}
        </dd>
        <dt>Servings</dt>
        <dd>{recipe.servings ?? "unknown"}</dd>
        <dt>Ingredients</dt>
        <dd>{recipe.ingredients.length}</dd>
        {recipe.classification === undefined ? null : (
          <>
            <dt>Dish</dt>
            <dd>
              {[
                recipe.classification.dish,
                recipe.classification.category,
                recipe.classification.cuisine ?? "",
              ]
                .filter((part) => part !== "")
                .join(" · ")}
            </dd>
          </>
        )}
      </dl>
      {recipe.nutrition === undefined ? null : (
        <ul className="mt-2 text-zinc-700 dark:text-zinc-300">
          <NutrientRow
            label="Energy"
            unit="kcal"
            nutrient={recipe.nutrition.kcal}
          />
          <NutrientRow
            label="Sugar"
            unit="g"
            nutrient={recipe.nutrition.sugarG}
          />
          <NutrientRow label="Fat" unit="g" nutrient={recipe.nutrition.fatG} />
        </ul>
      )}
      {recipe.ingredients.length === 0 ? null : (
        <table className="mt-2 w-full text-left text-xs">
          <thead className="text-zinc-500">
            <tr>
              <th className="pr-2 font-medium">Ingredient</th>
              <th className="pr-2 font-medium">AI</th>
              <th className="font-medium">Parser</th>
            </tr>
          </thead>
          <tbody>
            {recipe.ingredients.map((ingredient, index) => (
              // Lines can repeat ("salt"), and the list never reorders.
              <IngredientRow key={index} ingredient={ingredient} />
            ))}
          </tbody>
        </table>
      )}
      {recipe.extraction.warnings.length === 0 ? null : (
        <ul className="mt-2 text-amber-700 dark:text-amber-400">
          {recipe.extraction.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </article>
  );
};

export { RecipeCard };
