"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
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
 * Server Action — étape 2 : vérifie le code à 6 chiffres et ouvre la session.
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
  if (!/^\d{6}$/.test(token)) {
    return {
      status: "sent",
      method: "code",
      email,
      error: "Le code doit contenir 6 chiffres.",
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
