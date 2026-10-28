import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/env.server";

// Privileged backend client. Never expose through an unauthenticated data route.
export function createSupabaseServerClient() {
  const config = getSupabaseConfig();
  return createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
