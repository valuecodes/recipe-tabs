import { afterEach, describe, expect, it, vi } from "vitest";

import { checkAvailability, isAiReady } from "~/ai/availability";
import { createAiStub } from "~/test/language-model-stub";

describe("checkAvailability", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports unsupported when the globals are missing", async () => {
    expect(await checkAvailability()).toEqual({
      languageModel: "unsupported",
      languageDetector: "unsupported",
      translator: "unsupported",
    });
  });

  it("reports each API, mapping a rejected check to unavailable", async () => {
    const stub = createAiStub({
      availability: {
        LanguageModel: "downloadable",
        Translator: new Error("bad options"),
      },
    });
    for (const [name, value] of Object.entries(stub.globals)) {
      vi.stubGlobal(name, value);
    }
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await checkAvailability()).toEqual({
      languageModel: "downloadable",
      languageDetector: "available",
      translator: "unavailable",
    });
  });
});

describe("isAiReady", () => {
  it("needs all three APIs available", () => {
    expect(isAiReady(undefined)).toBe(false);
    expect(
      isAiReady({
        languageModel: "available",
        languageDetector: "available",
        translator: "downloadable",
      })
    ).toBe(false);
    expect(
      isAiReady({
        languageModel: "available",
        languageDetector: "available",
        translator: "available",
      })
    ).toBe(true);
  });
});
