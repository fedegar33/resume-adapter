import "server-only";
import { z } from "zod";

const requiredString = z.string().trim().min(1);
const openaiSchema = z.object({
  OPENAI_API_KEY: requiredString,
  OPENAI_MODEL: requiredString,
  OPENAI_REASONING_EFFORT: z.enum(["low", "medium", "high", "xhigh", "max"]).default("low"),
});
const supabaseSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: requiredString,
  SUPABASE_STORAGE_BUCKET: requiredString,
});

// Validate only the integration being used. Never include input values in errors.
function readConfig<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Missing or invalid environment variables: ${fields.join(", ")}`);
  }
  return result.data;
}

export function getOpenAIConfig() {
  return readConfig(openaiSchema, {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    OPENAI_REASONING_EFFORT: process.env.OPENAI_REASONING_EFFORT,
  });
}

export function getSupabaseConfig() {
  return readConfig(supabaseSchema, {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET || "resumes",
  });
}
