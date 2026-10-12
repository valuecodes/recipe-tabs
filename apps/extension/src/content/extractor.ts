// Bundled as the `recipeTabsExtractor` IIFE (see vite.config.ts); the build
// footer calls `run()` so its return value is what `executeScript` resolves
// with. The return value must survive structured cloning: plain data only.
// Placeholder capture until the page collector lands.
type ExtractorResult = { url: string; title: string };

const run = (): ExtractorResult => ({
  url: location.href,
  title: document.title,
});

export { run };
