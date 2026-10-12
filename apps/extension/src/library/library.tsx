import { isHttpUrl } from "~/lib/url";
import { useRecipes } from "~/storage/use-recipes";

// Minimal title list; grouping by dish arrives with classification.
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

const Library = () => {
  const { recipes, loading } = useRecipes();
  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold">Recipe library</h1>
      {loading ? (
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Loading…</p>
      ) : null}
      {!loading && recipes.length === 0 ? (
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          No saved recipes yet. Use the side panel on a recipe page.
        </p>
      ) : null}
      <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-700">
        {recipes.map((recipe) => {
          const linkable = isHttpUrl(recipe.url);
          return (
            <li key={recipe.id} className="py-3">
              {linkable ? (
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
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {linkable ? `${new URL(recipe.url).host} · ` : ""}
                {recipe.language} · saved{" "}
                {dateFormat.format(new Date(recipe.savedAt))}
              </p>
            </li>
          );
        })}
      </ul>
    </main>
  );
};

export { Library };
