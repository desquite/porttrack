import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@porttrack/shared";

/**
 * Supabase client for use in Client Components.
 * Reads from NEXT_PUBLIC_* env vars only.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
