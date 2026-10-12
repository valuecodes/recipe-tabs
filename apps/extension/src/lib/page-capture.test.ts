import { describe, expect, it } from "vitest";

import { isPageCapture } from "~/lib/page-capture";

const valid = {
  url: "https://example.com/r",
  title: "R",
  documentLanguage: "en",
  jsonLd: [],
  text: "",
};

describe("isPageCapture", () => {
  it("accepts a valid capture", () => {
    expect(isPageCapture(valid)).toBe(true);
  });

  it.each([
    ["missing url", { ...valid, url: undefined }],
    ["jsonLd not an array", { ...valid, jsonLd: {} }],
    ["numeric title", { ...valid, title: 1 }],
    ["missing text", { ...valid, text: undefined }],
    ["null", null],
    ["array", [valid]],
  ])("rejects %s", (_label, value) => {
    expect(isPageCapture(value)).toBe(false);
  });
});
