import { FI_EN } from "~/ai/availability";

type LanguageDecision = { language: string; confident: boolean };

// Below these the detector is guessing; trust the page's declared language.
const MIN_CONFIDENCE = 0.5;
const MIN_SAMPLE = 20;

// "fi-FI" → "fi"; empty → "und" (BCP 47 for undetermined).
const primaryLanguage = (tag: string): string => {
  const primary = tag.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  return primary === "" ? "und" : primary;
};

const decideLanguage = (
  results: readonly LanguageDetectionResult[],
  sample: string,
  declared: string
): LanguageDecision => {
  const top = results[0];
  const detected =
    top?.detectedLanguage === undefined
      ? "und"
      : primaryLanguage(top.detectedLanguage);
  if (
    detected !== "und" &&
    (top?.confidence ?? 0) > MIN_CONFIDENCE &&
    sample.trim().length >= MIN_SAMPLE
  ) {
    return { language: detected, confident: true };
  }
  return { language: primaryLanguage(declared), confident: false };
};

const detectLanguage = async (
  sample: string,
  declared: string,
  signal: AbortSignal
): Promise<LanguageDecision> => {
  const detector = await LanguageDetector.create({ signal });
  try {
    const results = await detector.detect(sample, { signal });
    return decideLanguage(results, sample, declared);
  } finally {
    detector.destroy();
  }
};

// Line by line, so translations stay aligned with the originals.
const translateLines = async (
  lines: readonly string[],
  signal: AbortSignal
): Promise<string[]> => {
  const translator = await Translator.create({ ...FI_EN, signal });
  try {
    const translated: string[] = [];
    for (const line of lines) {
      translated.push(
        line.trim() === "" ? line : await translator.translate(line, { signal })
      );
    }
    return translated;
  } finally {
    translator.destroy();
  }
};

export { decideLanguage, detectLanguage, primaryLanguage, translateLines };
