import { OpenAIProvider, type ModelProvider } from "@openai/agents";
import type { PomeradoOptions } from "./contracts.js";

type Providers = Pick<PomeradoOptions, "minterProvider" | "guardianProvider" | "outcomeReviewerProvider">;

/** Select the local host's model provider without exposing credentials in configuration files. */
export const configuredProviders = (
  options: Providers,
  env: NodeJS.ProcessEnv = process.env,
  factory: (key: string) => ModelProvider = (apiKey) =>
    new OpenAIProvider({ apiKey, baseURL: "https://openrouter.ai/api/v1", useResponses: true }),
): Providers => {
  const selection = env.POMERADO_MODEL_PROVIDER;
  if (selection === undefined || selection === "" || selection === "openai") return options;
  if (selection !== "openrouter") throw new Error("Unknown POMERADO_MODEL_PROVIDER.");
  if (!env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is required for OpenRouter.");
  const upstream = factory(env.OPENROUTER_API_KEY);
  const provider: ModelProvider = {
    getModel: (name) => upstream.getModel(name === undefined ? undefined : `openai/${name}`),
  };
  return {
    minterProvider: options.minterProvider ?? provider,
    guardianProvider: options.guardianProvider ?? provider,
    outcomeReviewerProvider: options.outcomeReviewerProvider ?? provider,
  };
};
