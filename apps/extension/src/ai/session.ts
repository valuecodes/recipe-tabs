import { RECIPE_SESSION_OPTIONS } from "~/ai/availability";

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

// The prompt did not fit the model's context window.
const isQuotaError = (error: unknown): boolean =>
  error instanceof Error && error.name === "QuotaExceededError";

export { createRecipeSession, isQuotaError, withTask };
