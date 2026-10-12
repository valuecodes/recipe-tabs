// The service worker only wires the toolbar icon to the side panel. Chrome
// stops idle workers at any time, so state and AI sessions live in the pages.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => {
    console.error("Failed to set side panel behavior", error);
  });
