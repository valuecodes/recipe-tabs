import { parseJsonLdBlocks } from "~/lib/json-ld-blocks";
import type { PageCapture } from "~/lib/page-capture";

// The only code that touches a page's DOM. Runs inside the page via
// `executeScript`, so it returns plain, structured-cloneable data and leaves
// all interpretation to `lib/`.
const MAX_TEXT_CHARS = 12_000;

const readMainText = (): string => {
  const root =
    document.querySelector<HTMLElement>("main") ??
    document.querySelector<HTMLElement>("article") ??
    document.body;
  return root.innerText.slice(0, MAX_TEXT_CHARS);
};

const collectPage = (): PageCapture => {
  const scripts = document.querySelectorAll(
    'script[type="application/ld+json"]'
  );
  const texts = Array.from(scripts, (script) => script.textContent);
  return {
    url: location.href,
    title: document.title,
    documentLanguage: document.documentElement.lang,
    jsonLd: parseJsonLdBlocks(texts),
    text: readMainText(),
  };
};

export { collectPage };
