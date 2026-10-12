import { isRecord } from "~/lib/guards";

// What the injected extractor returns from a page. It crosses the
// `executeScript` boundary by structured clone, so it is plain data, and the
// side panel receives it as `unknown` until `isPageCapture` narrows it.
type PageCapture = {
  url: string;
  title: string;
  documentLanguage: string;
  jsonLd: unknown[];
  text: string;
};

const isPageCapture = (value: unknown): value is PageCapture =>
  isRecord(value) &&
  typeof value.url === "string" &&
  typeof value.title === "string" &&
  typeof value.documentLanguage === "string" &&
  Array.isArray(value.jsonLd) &&
  typeof value.text === "string";

export type { PageCapture };
export { isPageCapture };
