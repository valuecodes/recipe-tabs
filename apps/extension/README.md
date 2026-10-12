# Recipe Tabs

A Chrome extension for saving recipes from the tab you are on and comparing them with
Chrome's built-in AI (Gemini Nano). It is an experiment in what on-device AI can do with
recipes, and it is early: this version saves recipes, reads their ingredients and
classifies them with AI.

## Requirements

- Chrome 138 or newer (desktop).
- For the built-in AI features, hardware that Chrome supports for Gemini Nano:
  Windows 10/11, macOS 13+, Linux or a Chromebook Plus; at least 22 GB of free disk space;
  and either a GPU with more than 4 GB of VRAM or a CPU with 16 GB of RAM and 4+ cores.
  `chrome://on-device-internals` shows the model status.

## Load it in Chrome

From the repo root:

```bash
pnpm install
pnpm --filter extension build   # or `dev` to rebuild on every change
```

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick `apps/extension/dist`.
3. Click the Recipe Tabs toolbar icon (pin it from the puzzle-piece menu) to open the side panel.

After a rebuild, press the reload button on the extension's card.

## Save a recipe

1. On a recipe page, click the Recipe Tabs toolbar icon. This also gives the extension
   permission to read that one tab.
2. Click **Detect recipe**. The preview shows the title, servings, ingredient count and any
   nutrition the site publishes. Pages with schema.org `Recipe` data give the best result;
   other pages are saved by title and page text.
3. Click **Save**. **Open library** lists everything you have saved.

If you switch tabs, click the toolbar icon again on the new tab before detecting; the side
panel says so when it is needed.

## On-device AI

The side panel's **On-device AI** box shows three parts of Chrome's built-in AI: the
language model (Gemini Nano), the language detector and the Finnish → English translator.
If any of them needs a download, click **Enable on-device AI** once; each shows its own
progress. The model is large, so the first download takes a while.

Once all three are ready, every saved recipe gets its ingredients read by the AI:

1. The language is detected from the title and the first ingredient lines (falling back
   to the page's declared language when the detector is unsure).
2. Finnish recipes are translated to English line by line, because Gemini Nano works in
   English. Recipes in other languages are not sent to the model; the card says so.
3. Gemini Nano returns the name, quantity and unit for each ingredient line. Pages without
   structured recipe data are read from the page text around an "Ingredients" /
   "Ainekset" heading.
4. Gemini Nano classifies the recipe from its English title and ingredient names: a short
   dish name ("panna cotta"), a category (main, soup, salad, dessert, baking, breakfast,
   snack, drink or other) and, when clear, a cuisine.

The recipe card shows each line next to the AI's reading and a simple built-in parser's
reading, so you can compare them. If you close the side panel mid-way, the work resumes
the next time it opens; a failed run gets a **Finish AI** button.

## Library

**Open library** groups saved recipes by the AI's dish name (recipes without one fall back
to their category, then to "Unclassified"). Each recipe has:

- **Finish AI**: runs the AI steps that have not finished yet.
- **Re-run AI**: discards the AI's results for that recipe and runs every step again.
- **Delete**: removes the recipe, stopping any AI work on it.

The library runs AI only when you click; unfinished recipes resume on their own only while
the side panel is open. The AI buttons need on-device AI to be enabled in the side panel.

## Findings

What Gemini Nano did with real recipes. Filled in from manual testing.

| Task                    | Recipes tried | Result | Typical latency |
| ----------------------- | ------------- | ------ | --------------- |
| Ingredients (JSON-LD)   |               |        |                 |
| Ingredients (page text) |               |        |                 |
| Finnish via Translator  |               |        |                 |
| Classification          |               |        |                 |

## Privacy

- The extension reads a page only when you click its toolbar icon on that tab (the
  `activeTab` permission). It has no access to any site otherwise.
- Everything it saves stays in your browser's extension storage.
- Nothing is sent anywhere: there is no server, no account and no telemetry. The built-in
  AI runs on your device.

## Common commands

| Task      | Command                             |
| --------- | ----------------------------------- |
| Dev       | `pnpm --filter extension dev`       |
| Build     | `pnpm --filter extension build`     |
| Typecheck | `pnpm --filter extension typecheck` |
| Test      | `pnpm --filter extension test`      |
| Clean     | `pnpm --filter extension clean`     |

Linting and formatting are repo-wide: run `pnpm lint` / `pnpm format` from the root.
