import { enrichmentLabel, needsEnrichment } from "~/lib/enrichment";
import type { RecipeGroup } from "~/lib/group";
import type { Recipe } from "~/lib/recipe";
import { isHttpUrl } from "~/lib/url";

// Page and model strings are rendered as React text only; links only for
// http(s) URLs.
type RecipeActions = {
  // The AI buttons need every on-device model to be available.
  ready: boolean;
  // Recipes some live page is enriching right now.
  heldIds: ReadonlySet<string>;
  onFinish: (id: string) => void;
  onRerun: (id: string) => void;
  onDelete: (recipe: Recipe) => void;
};

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

const buttonClass =
  "rounded border border-zinc-300 px-2 py-0.5 text-xs disabled:opacity-50 dark:border-zinc-600";

const details = (recipe: Recipe): string =>
  [
    isHttpUrl(recipe.url) ? new URL(recipe.url).host : "",
    recipe.language,
    `saved ${dateFormat.format(new Date(recipe.savedAt))}`,
    recipe.classification?.category ?? "",
    recipe.classification?.cuisine ?? "",
  ]
    .filter((part) => part !== "")
    .join(" · ");

const RecipeRow = ({
  recipe,
  actions,
}: {
  recipe: Recipe;
  actions: RecipeActions;
}) => {
  const held = actions.heldIds.has(recipe.id);
  return (
    <li className="py-3">
      {isHttpUrl(recipe.url) ? (
        <a
          href={recipe.url}
          target="_blank"
          rel="noreferrer"
          className="font-medium underline-offset-2 hover:underline"
        >
          {recipe.title}
        </a>
      ) : (
        <span className="font-medium">{recipe.title}</span>
      )}
      {recipe.titleEn === undefined ? null : (
        <span className="block text-sm text-zinc-500">{recipe.titleEn}</span>
      )}
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {details(recipe)}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-600 dark:text-zinc-400">
          {held ? "AI running…" : enrichmentLabel(recipe)}
        </span>
        {needsEnrichment(recipe) && !held ? (
          <button
            type="button"
            className={buttonClass}
            disabled={!actions.ready}
            onClick={() => {
              actions.onFinish(recipe.id);
            }}
          >
            Finish AI
          </button>
        ) : null}
        <button
          type="button"
          className={buttonClass}
          disabled={!actions.ready}
          onClick={() => {
            actions.onRerun(recipe.id);
          }}
        >
          Re-run AI
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            actions.onDelete(recipe);
          }}
        >
          Delete
        </button>
      </div>
    </li>
  );
};

const GroupedList = ({
  groups,
  actions,
}: {
  groups: readonly RecipeGroup[];
  actions: RecipeActions;
}) => (
  <div className="mt-4 space-y-6">
    {groups.map((group) => (
      <section key={group.key}>
        <h2 className="font-semibold capitalize">
          {group.label}{" "}
          <span className="font-normal text-zinc-500">
            ({group.recipes.length})
          </span>
        </h2>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {group.recipes.map((recipe) => (
            <RecipeRow key={recipe.id} recipe={recipe} actions={actions} />
          ))}
        </ul>
      </section>
    ))}
  </div>
);

export type { RecipeActions };
export { GroupedList };
