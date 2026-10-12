import { defineConfig } from "vitest/config";

// Pure modules and storage run under Node; the `chrome` global is stubbed per
// test (src/test/chrome-stub.ts). `tsconfigPaths` resolves the `~/` alias.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
