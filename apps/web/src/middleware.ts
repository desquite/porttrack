import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { updateSession } from "./lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  // 1. Refresh the Supabase session (sets/updates auth cookies).
  // We don't return this response directly — we let next-intl produce the
  // final response, and we copy the Supabase cookies onto it.
  const supabaseResponse = await updateSession(request);

  // 2. Run the next-intl middleware (handles locale detection + redirects).
  const intlResponse = intlMiddleware(request);

  // 3. Propagate the Supabase auth cookies onto the intl response.
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value, cookie);
  });

  return intlResponse;
}

export const config = {
  // Skip /api, /_next, /_vercel and any path with a file extension (assets).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
