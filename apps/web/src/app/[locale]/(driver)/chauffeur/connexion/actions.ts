"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toE164, phoneCore } from "./_lib/phone";

export type RequestOtpResult = { ok: true } | { ok: false; error: string };

/**
 * Server Action — demande d'envoi du code OTP de connexion chauffeur.
 *
 * SÉCURITÉ (faille « comptes fantômes ») : on NE déclenche JAMAIS
 * `signInWithOtp` pour un numéro qui ne correspond pas à un chauffeur ACTIF.
 * L'appel direct côté client (clé anon) créait sinon silencieusement un
 * `auth.users` pour n'importe quel numéro saisi (shouldCreateUser true par
 * défaut), polluant la base. La vérification se fait ici, côté serveur, AVANT
 * tout appel à Supabase Auth, via le client admin (bypass RLS).
 *
 * Premier login : le chauffeur n'a pas encore de compte auth. On le pré-crée
 * via `admin.createUser` (qui n'est PAS soumis à `enable_signup`), le trigger
 * `link_chauffeur_on_phone_signup` le relie au chauffeur, puis on envoie l'OTP
 * avec `shouldCreateUser: false`. Ainsi la création de compte par téléphone
 * peut rester désactivée côté projet sans casser le premier login.
 */
export async function requestDriverOtpAction(
  rawPhone: string,
): Promise<RequestOtpResult> {
  const e164 = toE164(rawPhone);
  const core = phoneCore(e164);
  if (core.length < 8) {
    return { ok: false, error: "Numéro de téléphone invalide." };
  }

  const admin = createAdminClient();

  // 1) Le numéro doit correspondre à un chauffeur ACTIF (matching cœur 8 chiffres).
  const { data: chauffeurs, error: listErr } = await admin
    .from("chauffeurs")
    .select("id, telephone, telephone_secondaire, auth_user_id, statut")
    .eq("statut", "ACTIF");

  if (listErr) {
    console.error("[driver-login] lecture chauffeurs:", listErr.message);
    return { ok: false, error: "Connexion impossible pour le moment. Réessaie." };
  }

  const match = (chauffeurs ?? []).find(
    (c) => phoneCore(c.telephone) === core || phoneCore(c.telephone_secondaire) === core,
  );

  if (!match) {
    // Numéro inconnu → refus AVANT tout appel à Auth (aucun compte créé).
    return {
      ok: false,
      error: "Numéro non reconnu. Contacte ton entreprise.",
    };
  }

  // 2) Premier login : pré-créer le compte auth (le trigger fait la liaison).
  if (!match.auth_user_id) {
    const { error: createErr } = await admin.auth.admin.createUser({
      phone: e164,
      phone_confirm: true,
    });
    // « already registered » = compte phone déjà présent (course / réessai) :
    // on continue, l'OTP de connexion partira quand même.
    if (createErr && !/already|registered|exists/i.test(createErr.message)) {
      console.error("[driver-login] createUser:", createErr.message);
      return { ok: false, error: "Connexion impossible pour le moment. Réessaie." };
    }
  }

  // 3) Envoi de l'OTP — sans création de compte (le compte existe désormais).
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone: e164,
    options: { shouldCreateUser: false },
  });

  if (error) {
    console.error("[driver-login] signInWithOtp:", error.message);
    return { ok: false, error: "Impossible d'envoyer le code. Réessaie dans un instant." };
  }

  return { ok: true };
}
