"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type DeclarePanneState = { status: "idle" } | { status: "error"; formError: string };

/**
 * Déclaration de panne PAR LE CHAUFFEUR (PWA). La panne porte TOUJOURS sur le
 * camion désigné du jour (re-dérivé côté serveur, pas de confiance au client).
 * Insert via admin (la RLS bloque le chauffeur sur `pannes`). Le trigger
 * pannes_sync_materiel_etat passe le matériel en EN_PANNE automatiquement.
 */
export async function declarePanneAction(
  _prev: DeclarePanneState,
  formData: FormData,
): Promise<DeclarePanneState> {
  const description = String(formData.get("description") ?? "").trim();
  if (description.length < 3) {
    return { status: "error", formError: "Décris la panne en quelques mots." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", formError: "Session expirée." };

  const { data: chauffeur } = await supabase
    .from("chauffeurs")
    .select("id, tenant_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!chauffeur) return { status: "error", formError: "Compte chauffeur introuvable." };

  const today = new Date().toISOString().slice(0, 10);
  const { data: des } = await supabase
    .from("designations")
    .select("materiel_roulant_id")
    .eq("chauffeur_id", chauffeur.id)
    .eq("date_designation", today)
    .not("validee_at", "is", null)
    .maybeSingle();
  if (!des?.materiel_roulant_id) {
    return { status: "error", formError: "Aucun camion ne t'est désigné aujourd'hui." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("pannes").insert({
    tenant_id: chauffeur.tenant_id,
    materiel_roulant_id: des.materiel_roulant_id,
    chauffeur_id: chauffeur.id, // qui a signalé (le garage le verra)
    description,
    // statut DECLAREE + date_declaration par défaut ; created_by null (le
    // chauffeur n'a pas de ligne public.users).
  });
  if (error) {
    console.error("[declarePanneAction]", error);
    return { status: "error", formError: `Erreur : ${error.message}` };
  }

  revalidatePath("/chauffeur");
  redirect("/chauffeur?panne=ok");
}
