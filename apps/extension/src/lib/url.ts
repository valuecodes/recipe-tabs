// A recipe's id is its normalised URL: the same page reached through a
// tracking link or with a fragment must map to one saved recipe.
const TRACKING_PARAMS = new Set(["fbclid", "gclid"]);

const parseHttpUrl = (raw: string): URL | undefined => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  return url.protocol === "http:" || url.protocol === "https:"
    ? url
    : undefined;
};

const isHttpUrl = (raw: string): boolean => parseHttpUrl(raw) !== undefined;

const normalizeRecipeUrl = (raw: string): string | undefined => {
  const url = parseHttpUrl(raw);
  if (url === undefined) {
    return undefined;
  }
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith("utm_") || TRACKING_PARAMS.has(key)) {
      url.searchParams.delete(key);
    }
  }
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  // `URL` already lower-cases the host; an emptied query leaves a bare "?".
  return url.toString().replace(/\?$/, "");
};

export { isHttpUrl, normalizeRecipeUrl };
