// Stand-ins for Chrome's built-in AI globals (`LanguageModel`,
// `LanguageDetector`, `Translator`). Install with `vi.stubGlobal(name, value)`
// for each entry of `globals`. Prompt answers are queued per test.
type PromptAnswer =
  | string
  | Error
  | ((input: string, signal: AbortSignal | undefined) => Promise<string>);

type AiStubOptions = {
  answers?: PromptAnswer[];
  detected?: LanguageDetectionResult[];
  translate?: (text: string) => string;
  availability?: Partial<Record<string, Availability | Error>>;
};

type AiStubCalls = {
  prompts: { input: string; signal: AbortSignal | undefined }[];
  translated: string[];
  sessionsCreated: number;
  clonesCreated: number;
  destroyed: number;
  detectorsDestroyed: number;
  translatorsDestroyed: number;
};

type AiStub = {
  globals: Record<"LanguageModel" | "LanguageDetector" | "Translator", unknown>;
  calls: AiStubCalls;
  answers: PromptAnswer[];
};

const abortError = (): Error =>
  new DOMException("The operation was aborted.", "AbortError");

const createAiStub = (options: AiStubOptions = {}): AiStub => {
  const answers = [...(options.answers ?? [])];
  const calls: AiStubCalls = {
    prompts: [],
    translated: [],
    sessionsCreated: 0,
    clonesCreated: 0,
    destroyed: 0,
    detectorsDestroyed: 0,
    translatorsDestroyed: 0,
  };

  const availability = (name: string) => async (): Promise<Availability> => {
    await Promise.resolve();
    const value = options.availability?.[name] ?? "available";
    if (value instanceof Error) {
      throw value;
    }
    return value;
  };

  const makeSession = (): Record<string, unknown> => ({
    prompt: async (
      input: string,
      promptOptions?: { signal?: AbortSignal }
    ): Promise<string> => {
      const signal = promptOptions?.signal;
      calls.prompts.push({ input, signal });
      if (signal?.aborted === true) {
        throw abortError();
      }
      const answer = answers.shift();
      if (answer === undefined) {
        throw new Error("No queued answer for this prompt");
      }
      if (answer instanceof Error) {
        throw answer;
      }
      return typeof answer === "string" ? answer : answer(input, signal);
    },
    clone: async (): Promise<Record<string, unknown>> => {
      await Promise.resolve();
      calls.clonesCreated += 1;
      return makeSession();
    },
    destroy: () => {
      calls.destroyed += 1;
    },
  });

  return {
    calls,
    answers,
    globals: {
      LanguageModel: {
        availability: availability("LanguageModel"),
        create: async (): Promise<Record<string, unknown>> => {
          await Promise.resolve();
          calls.sessionsCreated += 1;
          return makeSession();
        },
      },
      LanguageDetector: {
        availability: availability("LanguageDetector"),
        create: async (): Promise<Record<string, unknown>> => {
          await Promise.resolve();
          return {
            detect: async (): Promise<LanguageDetectionResult[]> => {
              await Promise.resolve();
              return (
                options.detected ?? [
                  { detectedLanguage: "en", confidence: 0.9 },
                ]
              );
            },
            destroy: () => {
              calls.detectorsDestroyed += 1;
            },
          };
        },
      },
      Translator: {
        availability: availability("Translator"),
        create: async (): Promise<Record<string, unknown>> => {
          await Promise.resolve();
          return {
            translate: async (text: string): Promise<string> => {
              await Promise.resolve();
              calls.translated.push(text);
              return (options.translate ?? ((line) => `EN ${line}`))(text);
            },
            destroy: () => {
              calls.translatorsDestroyed += 1;
            },
          };
        },
      },
    },
  };
};

export type { AiStub, PromptAnswer };
export { createAiStub };
