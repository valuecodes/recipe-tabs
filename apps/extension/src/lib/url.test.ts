import { describe, expect, it } from "vitest";

import { isHttpUrl, normalizeRecipeUrl } from "~/lib/url";

describe("normalizeRecipeUrl", () => {
  it("drops the hash and tracking params, keeps other params", () => {
    expect(
      normalizeRecipeUrl(
        "https://Example.COM/recipes/waffles/?utm_source=x&id=7&fbclid=y&gclid=z#steps"
      )
    ).toBe("https://example.com/recipes/waffles?id=7");
  });

  it("drops an emptied query and the trailing slash", () => {
    expect(normalizeRecipeUrl("https://example.com/a/?utm_medium=m")).toBe(
      "https://example.com/a"
    );
  });

  it("keeps the root path", () => {
    expect(normalizeRecipeUrl("http://example.com/")).toBe(
      "http://example.com/"
    );
  });

  it("rejects non-http(s) and unparseable URLs", () => {
    expect(normalizeRecipeUrl("ftp://example.com/a")).toBeUndefined();
    expect(normalizeRecipeUrl("javascript:alert(1)")).toBeUndefined();
    expect(normalizeRecipeUrl("chrome://extensions")).toBeUndefined();
    expect(normalizeRecipeUrl("not a url")).toBeUndefined();
  });
});

describe("isHttpUrl", () => {
  it("accepts only http(s)", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
  });
});
