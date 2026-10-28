import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import { defaultSettingsMiddleware, wrapLanguageModel } from "ai";
import { getOpenAIConfig } from "@/lib/env.server";

// One server-configured OpenAI model. Constructing it does not make an API call.
export function getResumeModel() {
  const config = getOpenAIConfig();
  const openai = createOpenAI({ apiKey: config.OPENAI_API_KEY });
  return wrapLanguageModel({
    model: openai.responses(config.OPENAI_MODEL),
    middleware: defaultSettingsMiddleware({
      settings: {
        providerOptions: {
          openai: { reasoningEffort: config.OPENAI_REASONING_EFFORT },
        },
      },
    }),
  });
}
