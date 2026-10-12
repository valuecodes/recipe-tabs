import { describe, expect, it } from "vitest";

import {
  describeCaptureError,
  isSameTab,
} from "~/sidepanel/extract-active-tab";

describe("describeCaptureError", () => {
  it.each([
    [
      "Cannot access a chrome:// URL",
      "Recipe Tabs can't read this kind of page",
    ],
    [
      'Cannot access contents of url "chrome-extension://abc/x.html".',
      "Recipe Tabs can't read this kind of page",
    ],
    [
      "The extensions gallery cannot be scripted.",
      "Recipe Tabs can't read this kind of page",
    ],
    [
      "Cannot access contents of the page. Extension manifest must request permission to access the respective host.",
      "Click the Recipe Tabs icon on this tab first",
    ],
    [
      'Cannot access contents of url "https://example.com/". Extension manifest must request permission to access this host.',
      "Click the Recipe Tabs icon on this tab first",
    ],
    ["No tab with id: 5.", "Couldn't read this page"],
  ])("maps %j", (message, expected) => {
    expect(describeCaptureError(message)).toBe(expected);
  });
});

describe("isSameTab", () => {
  const preview = { tabId: 3, recipeId: "https://example.com/r" };

  it("accepts the same tab on the same page", () => {
    expect(
      isSameTab(preview, { id: 3, url: "https://example.com/r/#top" })
    ).toBe(true);
  });

  it.each([
    ["another tab", { id: 4, url: "https://example.com/r" }],
    ["a navigated tab", { id: 3, url: "https://example.com/other" }],
    ["a tab without url", { id: 3 }],
    ["no tab", undefined],
  ])("rejects %s", (_label, tab) => {
    expect(isSameTab(preview, tab)).toBe(false);
  });
});
