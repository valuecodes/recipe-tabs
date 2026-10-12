import { useEffect, useRef, useState } from "react";

import { enricher } from "~/ai/app-enricher";
import { AI_APIS, isAiReady } from "~/ai/availability";
import { heldEnrichmentIds } from "~/ai/enrich";
import {
  findResumable,
  needsEnrichment,
  summarizeEnrichment,
} from "~/lib/enrichment";
import { recipeFromCapture } from "~/lib/recipe";
import type { Recipe } from "~/lib/recipe";
import { AiStatusPanel } from "~/sidepanel/ai-status";
import {
  extractActiveTab,
  getActiveTab,
  isSameTab,
} from "~/sidepanel/extract-active-tab";
import { RecipeCard } from "~/sidepanel/recipe-card";
import { useAiAvailability } from "~/sidepanel/use-ai-availability";
import { recipeRepository } from "~/storage/app-recipes";
import { useRecipes } from "~/storage/use-recipes";

type PanelState =
  | { kind: "idle" }
  | { kind: "detecting" }
  | { kind: "preview"; tabId: number; recipe: Recipe; saving: boolean }
  | { kind: "error"; message: string; detail?: string };

// A page that dies mid-run releases its lock without a storage change, so
// unfinished recipes are also re-checked on a timer.
const RESCAN_MS = 30_000;

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
  const { status, refresh } = useAiAvailability();
  const ready = isAiReady(status);
  // Enable cannot fix an API the device or browser does not have.
  const cannotEnable =
    status !== undefined &&
    AI_APIS.some(
      (api) => status[api] === "unavailable" || status[api] === "unsupported"
    );
  const [heldIds, setHeldIds] = useState<ReadonlySet<string>>(new Set());
  // Only the newest Detect click may set the preview.
  const requestRef = useRef(0);

  // Resume unfinished recipes (new saves included) once the AI is ready: on
  // every recipe change, and on a timer while any recipe is unfinished.
  const unfinished = recipes.some(needsEnrichment);
  useEffect(() => {
    let cancelled = false;
    const scan = async (): Promise<void> => {
      const held = await heldEnrichmentIds();
      if (cancelled) {
        return;
      }
      setHeldIds(held);
      if (ready) {
        for (const recipe of findResumable(recipes, held)) {
          enricher.enqueue(recipe.id);
        }
      }
    };
    const scanSafely = (): void => {
      scan().catch((error: unknown) => {
        console.error("Failed to check AI enrichment", error);
      });
    };
    scanSafely();
    const timer = unfinished ? setInterval(scanSafely, RESCAN_MS) : undefined;
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [ready, recipes, unfinished]);

  const finishFailed = (): void => {
    for (const recipe of recipes) {
      if (needsEnrichment(recipe) && recipe.enrichment.status === "failed") {
        enricher.enqueue(recipe.id);
      }
    }
  };

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
      setState(
        result.detail === undefined
          ? { kind: "error", message: result.message }
          : { kind: "error", message: result.message, detail: result.detail }
      );
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
      // `false` means it was already saved; the list below shows that. The
      // resume effect starts the AI steps once the new recipe shows up.
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

  // Once saved, show the stored recipe so AI results appear as they land.
  const stored =
    state.kind === "preview"
      ? recipes.find((saved) => saved.id === state.recipe.id)
      : undefined;
  const summary = summarizeEnrichment(recipes, heldIds);
  const unfinishedCount = summary.waiting + summary.failed;

  return (
    <main className="p-4 text-sm">
      <h1 className="text-base font-semibold">Recipe Tabs</h1>
      <AiStatusPanel status={status} refresh={refresh} />
      {summary.running + unfinishedCount === 0 ? null : (
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          AI: {summary.running} running · {summary.waiting} waiting ·{" "}
          {summary.failed} failed
          {ready && summary.failed > 0 ? (
            <button
              type="button"
              className="ml-2 underline"
              onClick={finishFailed}
            >
              Finish AI
            </button>
          ) : null}
          {!ready && unfinishedCount > 0 ? (
            <span className="block">
              {cannotEnable
                ? `On-device AI is not available here, so ${String(unfinishedCount)} recipe(s) wait.`
                : `Enable on-device AI to finish ${String(unfinishedCount)} recipe(s).`}
            </span>
          ) : null}
        </p>
      )}
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
      {state.kind === "error" && state.detail !== undefined ? (
        <p className="mt-1 text-xs wrap-break-word text-zinc-500">
          Chrome said: {state.detail}
        </p>
      ) : null}
      {state.kind === "preview" ? (
        <>
          <RecipeCard
            recipe={stored ?? state.recipe}
            saved={stored !== undefined}
          />
          {stored !== undefined ? (
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
