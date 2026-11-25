import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client that uses the SECRET key (acts as service_role,
// bypasses RLS). Only use it for server-owned data like weather_cache, never
// for user data like notes. `server-only` makes the build fail if a Client
// Component imports this file, so the key can't reach the browser.
//
// Returns null when SUPABASE_SECRET_KEY isn't set, so callers can fall back.
export function createAdminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
