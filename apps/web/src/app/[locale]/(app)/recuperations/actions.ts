"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RecuperationFormState =
  | { status: "idle" }
  | { status: "error"; formError: string; values?: Record<string, string> };

function readValues(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

/**
 * Planifie la récupération d'un conteneur livré : affecte camion + chauffeur
 * (+ remorque) et fixe la destination du vide (parc aconier / terminal).
 * Crée une ligne `recuperations` au statut PLANIFIEE.
 */
export async function planifierRecuperationAction(
  conteneurId: string,
  _prev: RecuperationFormState,
  formData: FormData,
): Promise<RecuperationFormState> {
  const values = readValues(formData);
  const chauffeurId = values.chauffeur_id?.trim();
  const tracteurId = values.tracteur_id?.trim();
  const remorqueId = values.remorque_id?.trim() || null;
  const datePlanifiee = values.date_planifiee?.trim() || null;
  const destinationType = values.destination_type?.trim();
  const destinationLieu = values.destination_lieu?.trim() || null;

  if (!chauffeurId) return { status: "error", formError: "Choisis un chauffeur.", values };
  if (!tracteurId) return { status: "error", formError: "Choisis un tracteur.", values };
  if (destinationType !== "PARC_ACONIER" && destinationType !== "TERMINAL") {
    return { status: "error", formError: "Choisis la destination du vide (parc aconier ou terminal).", values };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", formError: "Session expirée.", values };

  const { data: profile } = await supabase.from("users").select("tenant_id").eq("id", user.id).maybeSingle();
  const tenantId = profile?.tenant_id;
  if (!tenantId) return { status: "error", formError: "Aucune entreprise rattachée.", values };

  // Vérifie que le conteneur est bien livré
  const { data: conteneur } = await supabase
    .from("conteneurs").select("id, statut").eq("id", conteneurId).maybeSingle();
  if (!conteneur || conteneur.statut !== "LIVRE") {
    return { status: "error", formError: "Ce conteneur n'est pas (ou plus) au statut livré.", values };
  }

  // Snapshots (nom chauffeur, immat tracteur/remorque)
  const [{ data: ch }, { data: tr }, { data: rm }] = await Promise.all([
    supabase.from("chauffeurs").select("prenoms, nom").eq("id", chauffeurId).maybeSingle(),
    supabase.from("materiel_roulant").select("immatriculation").eq("id", tracteurId).maybeSingle(),
    remorqueId
      ? supabase.from("materiel_roulant").select("immatriculation").eq("id", remorqueId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const { error } = await supabase.from("recuperations").insert({
    tenant_id: tenantId,
    conteneur_id: conteneurId,
    statut: "PLANIFIEE",
    chauffeur_id: chauffeurId,
    tracteur_id: tracteurId,
    remorque_id: remorqueId,
    date_planifiee: datePlanifiee,
    destination_type: destinationType,
    destination_lieu: destinationLieu,
    chauffeur_nom: ch ? `${ch.prenoms} ${ch.nom}` : null,
    tracteur_immat: tr?.immatriculation ?? null,
    remorque_immat: rm?.immatriculation ?? null,
    created_by: user.id,
  });

  if (error) {
    if (error.code === "23505") {
      return { status: "error", formError: "Une récupération est déjà planifiée pour ce conteneur.", values };
    }
    return { status: "error", formError: `Erreur : ${error.message}`, values };
  }

  revalidatePath("/recuperations");
  redirect("/recuperations?planifie=1");
}

/**
 * Confirme la récupération (côté bureau) : le vide a été rendu. Ferme le cycle.
 */
export async function confirmerRecuperationAction(recuperationId: string, formData: FormData): Promise<void> {
  const dateRecuperation = String(formData.get("date_recuperation") ?? "").trim() || new Date().toISOString().slice(0, 10);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("recuperations")
    .update({ statut: "CONFIRMEE", date_recuperation: dateRecuperation, confirmed_by: user?.id ?? null })
    .eq("id", recuperationId);

  if (error) {
    redirect(`/recuperations?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/recuperations");
  redirect("/recuperations?onglet=recuperes&confirme=1");
}

/** Annule une planification (le conteneur redevient « à planifier »). */
export async function annulerRecuperationAction(recuperationId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("recuperations").update({ statut: "ANNULEE" }).eq("id", recuperationId);
  if (error) redirect(`/recuperations?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/recuperations");
  redirect("/recuperations?annule=1");
}
