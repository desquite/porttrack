"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendWhatsapp } from "@/lib/notifications/whatsapp-wasender";

// =============================================================================
// Construction du message WhatsApp (cahier §7.3)
// =============================================================================

function buildWhatsappMessage(args: {
  chauffeurNom: string;
  chauffeurPrenoms: string;
  chrono: string | null;
  immatriculation: string;
  equipeNom: string | null;
  heureDebut: string | null;
  heureFin: string | null;
}): string {
  const mrLabel = args.chrono
    ? `${args.chrono} (${args.immatriculation})`
    : args.immatriculation;

  const lines = [
    "PORTTRACK – Désignation du jour",
    "",
    `Bonjour ${args.chauffeurNom} ${args.chauffeurPrenoms},`,
    `Vous êtes désigné(e) sur ${mrLabel}.`,
  ];
  if (args.equipeNom) {
    const horaires = args.heureDebut && args.heureFin
      ? `${args.heureDebut.slice(0, 5)} – ${args.heureFin.slice(0, 5)}`
      : "horaires non précisés";
    lines.push(`Équipe : ${args.equipeNom} (${horaires})`);
  }
  lines.push("Effectuez votre check-list avant le départ.");

  return lines.join("\n");
}

// =============================================================================
// Envoi du WhatsApp + mise à jour du statut
// =============================================================================

async function sendDesignationWhatsapp(
  designationId: string,
): Promise<"SENT" | "FAILED" | "SKIPPED"> {
  const supabase = await createClient();

  // On recharge toutes les infos nécessaires au message
  const { data: d } = await supabase
    .from("designations")
    .select(`
      id, materiel_roulant_id, chauffeur_id, equipe_id,
      chauffeur:chauffeurs ( nom, prenoms, telephone ),
      materiel:materiel_roulant ( immatriculation ),
      equipe:equipes ( nom, heure_debut, heure_fin )
    `)
    .eq("id", designationId)
    .maybeSingle();

  if (!d) return "FAILED";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dAny = d as any;
  const chauffeur = dAny.chauffeur as { nom: string; prenoms: string; telephone: string } | null;
  const materiel  = dAny.materiel as { immatriculation: string } | null;
  // Le chrono (nom interne ex. TIGER 01) est sur la fiche materiel — on relit
  const { data: matExtra } = await supabase
    .from("materiel_roulant")
    .select("chrono")
    .eq("id", d.materiel_roulant_id)
    .maybeSingle();

  const equipe = dAny.equipe as { nom: string; heure_debut: string | null; heure_fin: string | null } | null;

  if (!chauffeur?.telephone) {
    await supabase
      .from("designations")
      .update({
        whatsapp_statut: "SKIPPED",
        whatsapp_error: "Téléphone chauffeur manquant",
        whatsapp_attempts: 1,
      })
      .eq("id", designationId);
    return "SKIPPED";
  }

  const message = buildWhatsappMessage({
    chauffeurNom: chauffeur.nom,
    chauffeurPrenoms: chauffeur.prenoms,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chrono: (matExtra as any)?.chrono ?? null,
    immatriculation: materiel?.immatriculation ?? "—",
    equipeNom: equipe?.nom ?? null,
    heureDebut: equipe?.heure_debut ?? null,
    heureFin: equipe?.heure_fin ?? null,
  });

  const result = await sendWhatsapp(chauffeur.telephone, message);

  const statut: "SENT" | "FAILED" | "SKIPPED" = result.ok ? "SENT" : result.skipped ? "SKIPPED" : "FAILED";
  await supabase
    .from("designations")
    .update({
      whatsapp_statut: statut,
      whatsapp_sent_at: result.ok ? new Date().toISOString() : null,
      whatsapp_error: result.ok ? null : (result.error ?? null),
      whatsapp_attempts: 1,
    })
    .eq("id", designationId);
  return statut;
}

// =============================================================================
// Écran de désignation 2 panneaux (cahier v8 §6.2) — brouillon + VALIDER TOUT
// =============================================================================
// Modèle : former une paire = créer une désignation BROUILLON (validee_at null,
// auto-sauvée, AUCUN WhatsApp). « VALIDER TOUT » valide tous les brouillons du
// jour et envoie le WhatsApp groupé. Verrouillage = dérivé de la date.

export type PaireResult = { ok: true; id?: string } | { ok: false; error: string };
export type ValiderToutResult =
  | { ok: true; total: number; sent: number; failed: number; skipped: number }
  | { ok: false; error: string };

/** Date du jour à Abidjan (UTC+0) au format YYYY-MM-DD. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
/** Date passée = journée VERROUILLÉE (immuable). */
function isLocked(dateStr: string): boolean {
  return dateStr < todayIso();
}
/** Au-delà de J+30 = HORS DÉLAI. */
function isHorsDelai(dateStr: string): boolean {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 30);
  return dateStr > horizon.toISOString().slice(0, 10);
}

/** Ajoute une paire chauffeur↔camion en BROUILLON (sans envoi WhatsApp). */
export async function addPaireAction(
  date: string,
  chauffeurId: string,
  materielId: string,
): Promise<PaireResult> {
  if (!date || !chauffeurId || !materielId) return { ok: false, error: "Paramètres manquants." };
  if (isLocked(date)) return { ok: false, error: "Journée verrouillée (date passée)." };
  if (isHorsDelai(date)) return { ok: false, error: "Date hors délai (au-delà de J+30)." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  const tenantId = profile?.tenant_id;
  if (!tenantId) return { ok: false, error: "Aucune entreprise rattachée à ton compte." };

  // Snapshot de l'équipe par défaut du chauffeur (pour le message à la validation)
  const { data: chauffeur } = await supabase
    .from("chauffeurs")
    .select("equipe_id_defaut")
    .eq("id", chauffeurId)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from("designations")
    .insert({
      tenant_id: tenantId,
      chauffeur_id: chauffeurId,
      materiel_roulant_id: materielId,
      date_designation: date,
      equipe_id: chauffeur?.equipe_id_defaut ?? null,
      created_by: user.id,
      // validee_at null (brouillon) + whatsapp_statut PENDING par défaut → pas d'envoi
    })
    .select("id")
    .single();

  if (error || !created) {
    if (error?.code === "23505") {
      if (error.message.includes("chauffeur")) return { ok: false, error: "Ce chauffeur est déjà désigné ce jour-là." };
      if (error.message.includes("materiel")) return { ok: false, error: "Ce camion est déjà attribué ce jour-là." };
    }
    if (error?.code === "42501" || error?.message.includes("row-level security")) {
      return { ok: false, error: "Tu n'as pas les droits pour cette opération." };
    }
    return { ok: false, error: error?.message ?? "Erreur inconnue." };
  }

  revalidatePath("/designations");
  return { ok: true, id: created.id };
}

/** Retire une paire — uniquement si encore BROUILLON et journée non verrouillée. */
export async function removePaireAction(designationId: string): Promise<PaireResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  const { data: row } = await supabase
    .from("designations")
    .select("validee_at, date_designation")
    .eq("id", designationId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Désignation introuvable." };
  if (row.validee_at) return { ok: false, error: "Désignation déjà validée — impossible de la retirer ici." };
  if (isLocked(row.date_designation)) return { ok: false, error: "Journée verrouillée (date passée)." };

  const { error } = await supabase.from("designations").delete().eq("id", designationId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/designations");
  return { ok: true };
}

/**
 * Libère un chauffeur d'une désignation dont le camion est tombé en panne :
 * on ANNULE la désignation (annulee_at) au lieu de la supprimer → la ligne et
 * sa check-list sont conservées (trace), et le chauffeur redevient disponible
 * (les contraintes UNIQUE sont partielles WHERE annulee_at IS NULL).
 */
export async function libererDesignationAction(designationId: string): Promise<PaireResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  const { error } = await supabase
    .from("designations")
    .update({ annulee_at: new Date().toISOString(), annulee_motif: "Camion en panne" })
    .eq("id", designationId)
    .is("annulee_at", null);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/designations");
  revalidatePath("/operations");
  return { ok: true };
}

/** Valide TOUS les brouillons du jour + envoi WhatsApp groupé. */
export async function validerToutAction(date: string): Promise<ValiderToutResult> {
  if (!date) return { ok: false, error: "Date manquante." };
  if (isLocked(date)) return { ok: false, error: "Journée verrouillée (date passée)." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  // Brouillons du jour (RLS limite déjà au tenant courant)
  const { data: drafts, error } = await supabase
    .from("designations")
    .select("id")
    .eq("date_designation", date)
    .is("validee_at", null);
  if (error) return { ok: false, error: error.message };
  if (!drafts || drafts.length === 0) {
    return { ok: false, error: "Aucune désignation en brouillon à valider pour cette date." };
  }

  const now = new Date().toISOString();
  let sent = 0, failed = 0, skipped = 0;
  for (const row of drafts) {
    // On valide d'abord (visible en aval), puis on envoie : le WhatsApp est
    // best-effort, un échec n'annule pas la validation (renvoi possible ensuite).
    await supabase.from("designations").update({ validee_at: now }).eq("id", row.id);
    const statut = await sendDesignationWhatsapp(row.id);
    if (statut === "SENT") sent += 1;
    else if (statut === "FAILED") failed += 1;
    else skipped += 1;
  }

  revalidatePath("/designations");
  revalidatePath("/planning");
  revalidatePath("/dashboard");
  return { ok: true, total: drafts.length, sent, failed, skipped };
}

// =============================================================================
// Renvoyer le WhatsApp
// =============================================================================

export async function resendWhatsappAction(designationId: string): Promise<void> {
  const supabase = await createClient();
  // Incrémente le compteur d'essais avant l'envoi (pour le suivi)
  const { data: cur } = await supabase
    .from("designations")
    .select("whatsapp_attempts")
    .eq("id", designationId)
    .maybeSingle();
  if (cur) {
    await supabase
      .from("designations")
      .update({ whatsapp_attempts: (cur.whatsapp_attempts ?? 0) + 1 })
      .eq("id", designationId);
  }
  await sendDesignationWhatsapp(designationId);
  revalidatePath(`/designations/${designationId}`);
  revalidatePath("/designations");
  redirect(`/designations/${designationId}?resent=1`);
}

// =============================================================================
// Suppression
// =============================================================================

export async function deleteDesignationAction(designationId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("designations").delete().eq("id", designationId);
  if (error) {
    redirect(`/designations/${designationId}?error=${encodeURIComponent(`Erreur : ${error.message}`)}`);
  }
  revalidatePath("/designations");
  revalidatePath("/planning");
  redirect("/designations?deleted=1");
}
