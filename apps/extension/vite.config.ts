import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// One `vite build` produces the whole unpacked extension in `dist/` from two
// environments. Neither empties `dist` (each would wipe the other's output),
// so the `build` and `dev` scripts `rm -rf dist` first.
// https://vite.dev/guide/api-environment
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  builder: {},
  build: { target: "chrome138" },
  environments: {
    // Extension pages plus the service worker. The manifest names the worker
    // `background.js`, so that one entry keeps a fixed, unhashed name.
    client: {
      build: {
        emptyOutDir: false,
        rolldownOptions: {
          input: {
            sidepanel: "sidepanel.html",
            library: "library.html",
            background: "src/background/service-worker.ts",
          },
          output: {
            entryFileNames: (chunk) =>
              chunk.name === "background"
                ? "[name].js"
                : "assets/[name]-[hash].js",
          },
        },
      },
    },
    // Injected on demand with `chrome.scripting.executeScript({ files })`,
    // which takes classic scripts only: one self-contained IIFE. The footer
    // makes the capture the script's completion value, which is what
    // `executeScript` returns, and re-injecting into the same tab just
    // redeclares the global.
    extractor: {
      consumer: "client",
      build: {
        emptyOutDir: false,
        copyPublicDir: false,
        rolldownOptions: {
          input: { extractor: "src/content/extractor.ts" },
          // Vite's app builds drop entry exports, which would tree-shake
          // `run` away and leave only the footer.
          preserveEntrySignatures: "exports-only",
          output: {
            format: "iife",
            name: "recipeTabsExtractor",
            codeSplitting: false,
            entryFileNames: "[name].js",
            footer: "recipeTabsExtractor.run();",
          },
        },
      },
    },
  },
});
