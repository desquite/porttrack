import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic link callback.
 *
 * Supabase appelle cette URL après que l'utilisateur a cliqué sur le lien
 * reçu par email. On échange le code d'autorisation contre une vraie
 * session, on pose les cookies, puis on redirige vers /dashboard.
 *
 * URL à whitelister dans Supabase :
 *   Authentication → URL Configuration → Redirect URLs
 *     http://localhost:3000/api/auth/callback
 *     https://<prod-domain>/api/auth/callback
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Supabase rapporte une erreur d'auth (lien expiré, déjà utilisé, etc.)
  if (error) {
    const params = new URLSearchParams({
      error: "auth_callback_failed",
      reason: errorDescription ?? error,
    });
    return NextResponse.redirect(`${origin}/login?${params.toString()}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code,
  );

  if (exchangeError) {
    console.error("[auth/callback] exchangeCodeForSession:", exchangeError);
    const params = new URLSearchParams({
      error: "exchange_failed",
      reason: exchangeError.message,
    });
    return NextResponse.redirect(`${origin}/login?${params.toString()}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
