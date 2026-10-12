# AGENTS.md - apps/extension

This directory inherits `/AGENTS.md`. This file lists only additions and overrides specific to the extension.

---

## What This Workspace Is

- Recipe Tabs: a Chrome MV3 extension (Chrome 138+) that saves recipes from the
  active tab and uses Chrome's built-in AI (Gemini Nano) to work with them.
- React 19 + Tailwind CSS 4 pages built by Vite 8; no dev server.
- Everything runs in the browser: no `host_permissions`, no server, no telemetry.

---

## Workspace Commands

| Task      | Command                             |
| --------- | ----------------------------------- |
| Dev       | `pnpm --filter extension dev`       |
| Build     | `pnpm --filter extension build`     |
| Typecheck | `pnpm --filter extension typecheck` |
| Test      | `pnpm --filter extension test`      |
| Clean     | `pnpm --filter extension clean`     |

`dev` is `vite build --watch`, not a dev server: load `apps/extension/dist` unpacked in
`chrome://extensions` and press the reload button after a rebuild.

---

## Local Conventions (Deltas from Root)

### Entry points

| File                               | Built as                 | Loaded by                                |
| ---------------------------------- | ------------------------ | ---------------------------------------- |
| `sidepanel.html` → `src/sidepanel` | `sidepanel.html`         | `side_panel.default_path` in manifest    |
| `library.html` → `src/library`     | `library.html`           | `chrome.tabs.create` from the side panel |
| `src/background/service-worker.ts` | `background.js`          | `background.service_worker` in manifest  |
| `src/content/extractor.ts`         | `extractor.js` (an IIFE) | `chrome.scripting.executeScript`         |

`public/manifest.json` is copied to `dist/` as-is. Entries are also listed in the root
`knip.jsonc`; add new ones in both places.

### Build

- `vite.config.ts` builds two environments in one `vite build`: `client` (pages and
  service worker) and `extractor`. Both set `emptyOutDir: false` so neither wipes the
  other; the `build` and `dev` scripts `rm -rf dist` first.
- The extractor contract: `src/content/extractor.ts` exports `run()`, the bundle is an
  IIFE assigned to `recipeTabsExtractor`, and the footer `recipeTabsExtractor.run();`
  makes the result the script's completion value, which `executeScript` returns. The
  result must be structured-cloneable plain data. `preserveEntrySignatures` keeps the
  export; without it Vite tree-shakes `run` away and the bundle is just the footer.
- The service worker only opens the side panel from `chrome.action.onClicked`. Chrome
  stops idle workers, so state and AI sessions belong in the pages.

### Source layout

- `src/lib/` is pure and DOM-free: anything from JSON-LD, `chrome.storage` or
  `executeScript` enters as `unknown` and is narrowed by guards there (`isPageCapture`,
  `isRecipe`). Tests run in Node (`vitest.config.ts`).
- `src/content/collect-page.ts` is the only code that reads a page's DOM.
- `src/storage/`: pages use the `RecipeRepository` type, never `chrome.storage` directly.
  One key per recipe (`recipe:<normalised url>`); `insert` is idempotent and `insert`,
  `update`, `remove` hold a Web Lock per recipe id, shared by all extension pages.
  `app-recipes.ts` holds the page-wide singletons; the factories stay importable in tests
  without a `chrome` global (`src/test/chrome-stub.ts`).
- Test fixtures under `src/test/fixtures/` are invented. Never paste real page content.

### Styling and TypeScript

- Same as playground: `src/globals.css` + `.postcssrc.json` (keep that name), and
  `"types": ["vite/client", "chrome"]` in `tsconfig.json`.

---

## Footguns / Gotchas

1. **`activeTab` is per tab and per click.** The side panel stays open across tabs, but
   `executeScript` only works on a tab whose toolbar icon the user clicked.
   Never switch to `setPanelBehavior({ openPanelOnActionClick: true })`: a click that
   Chrome turns into opening the panel grants no `activeTab`, so every Detect fails
   with "Cannot access contents of the page".
2. **`build` does not typecheck** - run `pnpm --filter extension typecheck`.
3. **Page strings are untrusted.** Anything read from a page renders as React text only.
