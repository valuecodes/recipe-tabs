// The service worker only wires the toolbar icon to the side panel. Chrome
// stops idle workers at any time, so state and AI sessions live in the pages.
//
// The icon click is handled here rather than with
// `setPanelBehavior({ openPanelOnActionClick: true })`: when Chrome opens the
// panel itself, the click does not grant `activeTab`, so the panel cannot read
// the tab. A plain action click does grant it, and `sidePanel.open` is allowed
// inside that click. Clicking the icon on another tab grants that tab too,
// while the panel stays open.
//
// The behavior setting persists across restarts, so turn off any value an
// earlier build stored, or `onClicked` would never fire.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: false })
  .catch((error: unknown) => {
    console.error("Failed to set side panel behavior", error);
  });

chrome.action.onClicked.addListener((tab) => {
  // Called synchronously: an `await` before it would lose the user gesture.
  chrome.sidePanel.open({ windowId: tab.windowId }).catch((error: unknown) => {
    console.error("Failed to open the side panel", error);
  });
});
