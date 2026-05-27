import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { updateSession } from "./lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Routes protégées : on REDIRIGE vers /login si l'utilisateur n'a pas
 * de session. Le match accepte le préfixe locale optionnel (/fr, /en…).
 */
const PROTECTED_PATTERN = /^(?:\/(fr|en))?\/(dashboard|app)(\/|$)/;

/**
 * Routes auth (login, verify…) : on REDIRIGE vers /dashboard si l'utilisateur
 * est DÉJÀ connecté. Évite de revoir le formulaire de login avec une session.
 */
const AUTH_PAGES_PATTERN = /^(?:\/(fr|en))?\/login(\/|$)/;

export async function middleware(request: NextRequest) {
  // 1. Refresh la session Supabase + récupère le user.
  const { response: supabaseResponse, user } = await updateSession(request);

  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PATTERN.test(pathname);
  const isAuthPage = AUTH_PAGES_PATTERN.test(pathname);

  // 2. Garde-fous d'auth — court-circuitent next-intl si besoin.
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 3. Routing next-intl (gère la détection/redirection de locale).
  const intlResponse = intlMiddleware(request);

  // 4. Propage les cookies de session sur la réponse finale.
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value, cookie);
  });

  return intlResponse;
}

export const config = {
  // Skip /api, /_next, /_vercel et tout fichier statique (assets).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
