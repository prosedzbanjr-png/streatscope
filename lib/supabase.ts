import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function getSupabase() {
  if (!url || !key) {
    throw new Error("Brakuje konfiguracji Supabase.");
  }

  if (!client) {
    client = createClient(url, key);
  }

  return client;
}
