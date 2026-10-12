import { useEffect, useRef, useState } from "react";

import { recipeFromCapture } from "~/lib/recipe";
import type { Recipe } from "~/lib/recipe";
import {
  extractActiveTab,
  getActiveTab,
  isSameTab,
} from "~/sidepanel/extract-active-tab";
import { RecipeCard } from "~/sidepanel/recipe-card";
import { recipeRepository } from "~/storage/app-recipes";
import { useRecipes } from "~/storage/use-recipes";

type PanelState =
  | { kind: "idle" }
  | { kind: "detecting" }
  | { kind: "preview"; tabId: number; recipe: Recipe; saving: boolean }
  | { kind: "error"; message: string };

const TAB_CHANGED = "This tab changed. Detect again.";
const NOT_A_WEB_PAGE = "Recipe Tabs can't read this kind of page";

const buttonClass =
  "rounded bg-zinc-900 px-3 py-1.5 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";
const secondaryButtonClass =
  "rounded border border-zinc-300 px-3 py-1.5 dark:border-zinc-600";

const openLibrary = (): void => {
  chrome.tabs
    .create({ url: chrome.runtime.getURL("library.html") })
    .catch((error: unknown) => {
      console.error("Failed to open the library", error);
    });
};

const SidePanel = () => {
  const [state, setState] = useState<PanelState>({ kind: "idle" });
  const { recipes } = useRecipes();
  // Only the newest Detect click may set the preview.
  const requestRef = useRef(0);

  // A preview belongs to the tab it was read from: drop it on tab switch.
  useEffect(() => {
    const onActivated = (): void => {
      requestRef.current += 1;
      setState({ kind: "idle" });
    };
    chrome.tabs.onActivated.addListener(onActivated);
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
    };
  }, []);

  const detect = async (): Promise<void> => {
    requestRef.current += 1;
    const request = requestRef.current;
    setState({ kind: "detecting" });
    const result = await extractActiveTab();
    if (request !== requestRef.current) {
      return;
    }
    if (!result.ok) {
      setState({ kind: "error", message: result.message });
      return;
    }
    const recipe = recipeFromCapture(result.capture, Date.now());
    setState(
      recipe === undefined
        ? { kind: "error", message: NOT_A_WEB_PAGE }
        : { kind: "preview", tabId: result.tabId, recipe, saving: false }
    );
  };

  const save = async (tabId: number, recipe: Recipe): Promise<void> => {
    const request = requestRef.current;
    setState({ kind: "preview", tabId, recipe, saving: true });
    try {
      const tab = await getActiveTab();
      if (!isSameTab({ tabId, recipeId: recipe.id }, tab)) {
        if (request === requestRef.current) {
          setState({ kind: "error", message: TAB_CHANGED });
        }
        return;
      }
      // `false` means it was already saved; the list below shows that.
      await recipeRepository.insert(recipe);
    } catch (error) {
      console.error("Failed to save the recipe", error);
      if (request === requestRef.current) {
        setState({ kind: "error", message: "Couldn't save this recipe" });
      }
      return;
    }
    if (request === requestRef.current) {
      setState({ kind: "preview", tabId, recipe, saving: false });
    }
  };

  const alreadySaved =
    state.kind === "preview" &&
    recipes.some((saved) => saved.id === state.recipe.id);

  return (
    <main className="p-4 text-sm">
      <h1 className="text-base font-semibold">Recipe Tabs</h1>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={state.kind === "detecting"}
          onClick={() => {
            void detect();
          }}
        >
          {state.kind === "detecting" ? "Detecting…" : "Detect recipe"}
        </button>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={openLibrary}
        >
          Open library
        </button>
      </div>
      {state.kind === "idle" ? (
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Open a recipe page and click Detect recipe.
        </p>
      ) : null}
      {state.kind === "error" ? (
        <p role="alert" className="mt-3 text-red-700 dark:text-red-400">
          {state.message}
        </p>
      ) : null}
      {state.kind === "preview" ? (
        <>
          <RecipeCard recipe={state.recipe} />
          {alreadySaved ? (
            <p className="mt-3 text-green-700 dark:text-green-400">
              Saved in your library.
            </p>
          ) : (
            <button
              type="button"
              className={`${buttonClass} mt-3`}
              disabled={state.saving}
              onClick={() => {
                void save(state.tabId, state.recipe);
              }}
            >
              {state.saving ? "Saving…" : "Save"}
            </button>
          )}
        </>
      ) : null}
    </main>
  );
};

export { SidePanel };
