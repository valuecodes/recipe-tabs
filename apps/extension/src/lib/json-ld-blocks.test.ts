import { describe, expect, it } from "vitest";

import {
  MAX_BLOCK_CHARS,
  MAX_TOTAL_CHARS,
  parseJsonLdBlocks,
} from "~/lib/json-ld-blocks";

const blockOf = (length: number): string =>
  JSON.stringify({ pad: "x".repeat(length - 10) });

describe("parseJsonLdBlocks", () => {
  it("parses valid blocks and skips malformed ones", () => {
    expect(parseJsonLdBlocks(['{"a":1}', "{oops", "[2]"])).toEqual([
      { a: 1 },
      [2],
    ]);
  });

  it("skips a single oversized block but keeps later ones", () => {
    expect(parseJsonLdBlocks([blockOf(MAX_BLOCK_CHARS + 1), "3"])).toEqual([3]);
  });

  it("stops once the total budget would be exceeded", () => {
    const block = blockOf(MAX_BLOCK_CHARS - 1);
    const count = Math.ceil(MAX_TOTAL_CHARS / block.length) + 1;
    const parsed = parseJsonLdBlocks(
      Array.from({ length: count }, () => block)
    );
    expect(parsed.length).toBeLessThan(count);
    expect(parsed.length * block.length).toBeLessThanOrEqual(MAX_TOTAL_CHARS);
  });
});
