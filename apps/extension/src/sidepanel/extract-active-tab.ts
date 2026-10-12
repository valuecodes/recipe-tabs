import { isPageCapture } from "~/lib/page-capture";
import type { PageCapture } from "~/lib/page-capture";
import { normalizeRecipeUrl } from "~/lib/url";

type CaptureResult =
  | { ok: true; tabId: number; capture: PageCapture }
  | { ok: false; message: string; detail?: string };

const CANNOT_READ = "Recipe Tabs can't read this kind of page";
const CLICK_ICON = "Click the Recipe Tabs icon on this tab first";
const GENERIC = "Couldn't read this page";

// `activeTab` is granted per tab by a toolbar click and lost on cross-origin
// navigation; the side panel outlives both. Chrome's error text is the only
// signal, so map it to something the user can act on.
const describeCaptureError = (message: string): string => {
  if (
    /chrome:\/\/|edge:\/\/|chrome-extension:\/\/|extensions gallery/i.test(
      message
    )
  ) {
    return CANNOT_READ;
  }
  if (/cannot access contents|permission/i.test(message)) {
    return CLICK_ICON;
  }
  return GENERIC;
};

const getActiveTab = async (): Promise<chrome.tabs.Tab | undefined> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
};

const extractActiveTab = async (): Promise<CaptureResult> => {
  try {
    const tab = await getActiveTab();
    if (tab?.id === undefined) {
      return { ok: false, message: GENERIC };
    }
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["extractor.js"],
    });
    const result: unknown = results[0]?.result;
    return isPageCapture(result)
      ? { ok: true, tabId: tab.id, capture: result }
      : { ok: false, message: GENERIC };
  } catch (error) {
    // Chrome's own text, kept for the panel and the console: the mapped
    // message alone cannot tell a missing grant from a restricted page.
    const detail = error instanceof Error ? error.message : String(error);
    console.warn("executeScript failed", error);
    return { ok: false, message: describeCaptureError(detail), detail };
  }
};

// A preview may only be saved while the active tab still shows the page it
// came from. Without the activeTab grant `tab.url` is missing: treat that as
// changed rather than guess.
const isSameTab = (
  preview: { tabId: number; recipeId: string },
  tab: { id?: number; url?: string } | undefined
): boolean =>
  tab?.id === preview.tabId &&
  tab.url !== undefined &&
  normalizeRecipeUrl(tab.url) === preview.recipeId;

export { describeCaptureError, extractActiveTab, getActiveTab, isSameTab };
