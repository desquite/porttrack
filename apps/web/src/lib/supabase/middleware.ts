import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the user's Supabase session on every navigation.
 * Returns a NextResponse with updated auth cookies that the
 * outer middleware should chain with the next-intl response.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip session refresh if Supabase isn't configured yet (e.g. first
  // `pnpm dev` before .env.local is filled in). Avoids crashing the
  // middleware on every request during early bootstrap.
  if (!url || !anonKey || url.includes("<") || anonKey.includes("<")) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    url,
    anonKey,
    {
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
    },
  );

  // IMPORTANT: getUser() validates the token with the Supabase auth server.
  // Do not run any code between createServerClient and getUser().
  await supabase.auth.getUser();

  return supabaseResponse;
}
