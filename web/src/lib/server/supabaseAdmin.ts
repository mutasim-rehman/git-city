import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ensureEnvLoaded } from "./loadEnv";

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  ensureEnvLoaded();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!client) {
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}
