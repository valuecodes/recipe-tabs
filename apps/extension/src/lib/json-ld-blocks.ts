// Parses the text of a page's `application/ld+json` scripts. Bounded so a
// huge or hostile page cannot stall the extractor or bloat what
// `executeScript` has to clone back to the side panel.
const MAX_BLOCK_CHARS = 500_000;
const MAX_TOTAL_CHARS = 1_000_000;

const parseJsonLdBlocks = (texts: readonly string[]): unknown[] => {
  const parsed: unknown[] = [];
  let total = 0;
  for (const text of texts) {
    if (text.length > MAX_BLOCK_CHARS) {
      continue;
    }
    if (total + text.length > MAX_TOTAL_CHARS) {
      break;
    }
    total += text.length;
    try {
      parsed.push(JSON.parse(text));
    } catch {
      // Malformed blocks are common in the wild; skip them.
    }
  }
  return parsed;
};

export { MAX_BLOCK_CHARS, MAX_TOTAL_CHARS, parseJsonLdBlocks };
