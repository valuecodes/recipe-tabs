// Chrome's built-in AI: the Prompt API (Gemini Nano), the Language Detector
// and the fi→en Translator. The globals are typed by `dom-chromium-ai` but may
// be missing at runtime (older Chrome), so every use checks `in globalThis`.
type AiApi = "languageModel" | "languageDetector" | "translator";

type AiAvailability = Availability | "unsupported";

type AiStatus = Record<AiApi, AiAvailability>;

const AI_APIS: readonly AiApi[] = [
  "languageModel",
  "languageDetector",
  "translator",
];

// Shared by `availability()`, the click-time `create()` and every session:
// Chrome answers availability for these exact options, so they must match.
const RECIPE_SESSION_OPTIONS = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
} satisfies LanguageModelCreateCoreOptions;

const FI_EN = {
  sourceLanguage: "fi",
  targetLanguage: "en",
} satisfies TranslatorCreateCoreOptions;

const GLOBALS: Record<AiApi, string> = {
  languageModel: "LanguageModel",
  languageDetector: "LanguageDetector",
  translator: "Translator",
};

const hasApi = (api: AiApi): boolean => GLOBALS[api] in globalThis;

const check = async (
  api: AiApi,
  query: () => Promise<Availability>
): Promise<AiAvailability> => {
  if (!hasApi(api)) {
    return "unsupported";
  }
  try {
    return await query();
  } catch (error) {
    console.error(`Failed to check ${api} availability`, error);
    return "unavailable";
  }
};

const checkAvailability = async (): Promise<AiStatus> => {
  const [languageModel, languageDetector, translator] = await Promise.all([
    check("languageModel", () =>
      LanguageModel.availability(RECIPE_SESSION_OPTIONS)
    ),
    check("languageDetector", () => LanguageDetector.availability()),
    check("translator", () => Translator.availability(FI_EN)),
  ]);
  return { languageModel, languageDetector, translator };
};

// Enrichment needs all three: the language is only known after detection, so
// a Finnish recipe must never start without its translator.
const isAiReady = (status: AiStatus | undefined): boolean =>
  status !== undefined && AI_APIS.every((api) => status[api] === "available");

export type { AiApi, AiAvailability, AiStatus };
export {
  AI_APIS,
  checkAvailability,
  FI_EN,
  hasApi,
  isAiReady,
  RECIPE_SESSION_OPTIONS,
};
