import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@porttrack/shared";

export type SessionResult = {
  response: NextResponse;
  user: User | null;
};

/**
 * Refreshes the user's Supabase session on every navigation.
 * Returns both the response (with updated auth cookies) and the
 * authenticated user, so the outer middleware can route based on it.
 */
export async function updateSession(
  request: NextRequest,
): Promise<SessionResult> {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip session refresh if Supabase isn't configured yet (e.g. first
  // `pnpm dev` before .env.local is filled in). Avoids crashing the
  // middleware on every request during early bootstrap.
  if (!url || !anonKey || url.includes("<") || anonKey.includes("<")) {
    return { response: supabaseResponse, user: null };
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: getUser() validates the token with the Supabase auth server.
  // Do not run any code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response: supabaseResponse, user };
}
