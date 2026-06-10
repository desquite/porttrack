"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type LoginState = {
  status: "idle" | "sent" | "error";
  method?: "code" | "link";
  email?: string;
  error?: string;
};

/**
 * Server Action — étape 1 : demande l'envoi d'un email OTP.
 *
 * Supabase envoie naturellement les DEUX moyens d'authent dans le même email :
 * un code à 6 chiffres ET un lien magique. C'est l'UI qui décide laquelle
 * des deux UX présenter à l'utilisateur (champ code ou message d'attente).
 */
export async function requestOtpAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const method = (String(formData.get("method") ?? "code") === "link"
    ? "link"
    : "code") as "code" | "link";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", method, email, error: "Adresse email invalide." };
  }

  // Avant d'envoyer un OTP : vérifier que l'adresse correspond à un compte
  // PORTTRACK existant et actif. Sans ce check, signInWithOtp créerait
  // silencieusement un nouveau utilisateur Supabase Auth (shouldCreateUser true
  // par défaut), polluant la base et envoyant des emails à des destinataires
  // arbitraires. Vérification via client admin pour bypasser la RLS qui
  // protège public.users.
  const admin = createAdminClient();
  const { data: account } = await admin
    .from("users")
    .select("id, actif")
    .eq("email", email)
    .maybeSingle();

  if (!account) {
    return {
      status: "error",
      method,
      email,
      error: "Aucun compte n'est associé à cette adresse. Contacte ton administrateur.",
    };
  }
  if (!account.actif) {
    return {
      status: "error",
      method,
      email,
      error: "Compte désactivé. Contacte ton administrateur.",
    };
  }

  const supabase = await createClient();
  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${protocol}://${host}/api/auth/callback`,
    },
  });

  if (error) {
    console.error("[login] signInWithOtp error:", error.message);
    return {
      status: "error",
      method,
      email,
      error: "Impossible d'envoyer le code. Réessaie dans un instant.",
    };
  }

  return { status: "sent", method, email };
}

/**
 * Server Action — étape 2 : vérifie le code OTP (6 à 10 chiffres selon la
 * config Supabase Auth → Email OTP Length) et ouvre la session.
 */
export async function verifyOtpAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("token") ?? "").replace(/\s+/g, "");

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", method: "code", email, error: "Email invalide." };
  }
  if (!/^\d{6,10}$/.test(token)) {
    return {
      status: "sent",
      method: "code",
      email,
      error: "Le code doit contenir entre 6 et 10 chiffres.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    console.error("[login] verifyOtp error:", error.message);
    return {
      status: "sent",
      method: "code",
      email,
      error: "Code incorrect ou expiré. Essaie à nouveau.",
    };
  }

  // Session établie — redirige vers le dashboard
  redirect("/dashboard");
}
