import { afterEach, describe, expect, it, vi } from "vitest";

import {
  decideLanguage,
  detectLanguage,
  primaryLanguage,
  translateLines,
} from "~/ai/language";
import { createAiStub } from "~/test/language-model-stub";

const LONG_SAMPLE = "Pannacotta\n2 dl kermaa\n1 dl sokeria";

const install = (stub: ReturnType<typeof createAiStub>): void => {
  for (const [name, value] of Object.entries(stub.globals)) {
    vi.stubGlobal(name, value);
  }
};

describe("primaryLanguage", () => {
  it.each([
    ["fi-FI", "fi"],
    ["EN_us", "en"],
    ["", "und"],
    ["  ", "und"],
  ])("%s → %s", (tag, expected) => {
    expect(primaryLanguage(tag)).toBe(expected);
  });
});

describe("decideLanguage", () => {
  it("trusts a confident detection on a long enough sample", () => {
    expect(
      decideLanguage(
        [{ detectedLanguage: "fi", confidence: 0.9 }],
        LONG_SAMPLE,
        "en"
      )
    ).toEqual({ language: "fi", confident: true });
  });

  it("falls back to the declared language on low confidence", () => {
    expect(
      decideLanguage(
        [{ detectedLanguage: "et", confidence: 0.4 }],
        LONG_SAMPLE,
        "fi-FI"
      )
    ).toEqual({ language: "fi", confident: false });
  });

  it("falls back on a short sample", () => {
    expect(
      decideLanguage(
        [{ detectedLanguage: "de", confidence: 0.99 }],
        "Torte",
        "en"
      )
    ).toEqual({ language: "en", confident: false });
  });

  it("falls back on no or undetermined results", () => {
    expect(decideLanguage([], LONG_SAMPLE, "fi")).toEqual({
      language: "fi",
      confident: false,
    });
    expect(
      decideLanguage(
        [{ detectedLanguage: "und", confidence: 0.99 }],
        LONG_SAMPLE,
        ""
      )
    ).toEqual({ language: "und", confident: false });
  });
});

describe("with the AI stub", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects with a fallback and destroys the detector", async () => {
    const stub = createAiStub({
      detected: [{ detectedLanguage: "fi", confidence: 0.3 }],
    });
    install(stub);
    const decision = await detectLanguage(
      LONG_SAMPLE,
      "fi-FI",
      new AbortController().signal
    );
    expect(decision).toEqual({ language: "fi", confident: false });
    expect(stub.calls.detectorsDestroyed).toBe(1);
  });

  it("translates line by line, keeping empty lines aligned", async () => {
    const stub = createAiStub();
    install(stub);
    const lines = await translateLines(
      ["2 dl maitoa", "", "suolaa"],
      new AbortController().signal
    );
    expect(lines).toEqual(["EN 2 dl maitoa", "", "EN suolaa"]);
    expect(stub.calls.translated).toEqual(["2 dl maitoa", "suolaa"]);
    expect(stub.calls.translatorsDestroyed).toBe(1);
  });

  it("destroys the translator when a translation fails", async () => {
    const stub = createAiStub({
      translate: () => {
        throw new Error("boom");
      },
    });
    install(stub);
    await expect(
      translateLines(["x"], new AbortController().signal)
    ).rejects.toThrow("boom");
    expect(stub.calls.translatorsDestroyed).toBe(1);
  });
});
