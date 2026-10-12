import { collectPage } from "~/content/collect-page";
import type { PageCapture } from "~/lib/page-capture";

// Bundled as the `recipeTabsExtractor` IIFE (see vite.config.ts); the build
// footer calls `run()` so its return value is what `executeScript` resolves
// with. The return value must survive structured cloning: plain data only.
const run = (): PageCapture => collectPage();

export { run };
