import { RECIPE_SESSION_OPTIONS } from "~/ai/availability";
import type { PromptRequest } from "~/ai/prompts";

const SYSTEM_PROMPT =
  "You read recipes and answer only with JSON in the requested shape. " +
  "Use English. Never add an ingredient that is not in the input.";

const createRecipeSession = (signal: AbortSignal): Promise<LanguageModel> =>
  LanguageModel.create({
    ...RECIPE_SESSION_OPTIONS,
    initialPrompts: [{ role: "system", content: SYSTEM_PROMPT }],
    signal,
  });

// Every task runs on its own clone of the base session, so tasks never share
// context or overflow it, and the clone is destroyed whatever happens.
const withTask = async <T>(
  base: LanguageModel,
  signal: AbortSignal,
  task: (session: LanguageModel) => Promise<T>
): Promise<T> => {
  const session = await base.clone({ signal });
  try {
    return await task(session);
  } finally {
    session.destroy();
  }
};

// One schema-constrained prompt on its own clone; the raw answer is parsed by
// the caller (`ai/parse-response.ts`).
const askJson = async (
  base: LanguageModel,
  signal: AbortSignal,
  request: PromptRequest
): Promise<string> =>
  withTask(base, signal, (session) =>
    session.prompt(request.input, {
      responseConstraint: request.responseConstraint,
      ...(request.omitResponseConstraintInput === true
        ? { omitResponseConstraintInput: true }
        : {}),
      signal,
    })
  );

// The prompt did not fit the model's context window.
const isQuotaError = (error: unknown): boolean =>
  error instanceof Error && error.name === "QuotaExceededError";

export { askJson, createRecipeSession, isQuotaError };
