import type { NutrientValue } from "~/lib/nutrition";
import type { Recipe } from "~/lib/recipe";
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

const RecipeCard = ({ recipe }: { recipe: Recipe }) => {
  const host = hostOf(recipe.url);
  return (
    <article className="mt-4 rounded border border-zinc-200 p-3 dark:border-zinc-700">
      <h2 className="font-semibold">{recipe.title}</h2>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-zinc-700 dark:text-zinc-300">
        {host === undefined ? null : (
          <>
            <dt>Site</dt>
            <dd>{host}</dd>
          </>
        )}
        <dt>Language</dt>
        <dd>{recipe.language}</dd>
        <dt>Servings</dt>
        <dd>{recipe.servings ?? "unknown"}</dd>
        <dt>Ingredients</dt>
        <dd>{recipe.ingredients.length}</dd>
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
