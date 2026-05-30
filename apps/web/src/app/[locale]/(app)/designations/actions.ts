"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { designationCreateSchema, type DesignationCreateInput } from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";
import { sendWhatsapp } from "@/lib/notifications/whatsapp-wasender";

// =============================================================================
// État formulaire
// =============================================================================

export type DesignationFormState =
  | { status: "idle" }
  | {
      status: "error";
      formError?: string;
      fieldErrors?: Partial<Record<keyof DesignationCreateInput, string[]>>;
      values?: Partial<Record<string, string>>;
    };

function readFormValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function parseFormData(values: Record<string, string>) {
  const parsed = designationCreateSchema.safeParse(values);
  if (parsed.success) return { ok: true as const, data: parsed.data };
  const fieldErrors: Partial<Record<keyof DesignationCreateInput, string[]>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as keyof DesignationCreateInput | undefined;
    if (!field) continue;
    (fieldErrors[field] ??= []).push(issue.message);
  }
  return {
    ok: false as const,
    state: {
      status: "error" as const,
      formError: "Corrige les champs en rouge.",
      fieldErrors,
      values,
    },
  };
}

function mapDbErr(error: { code?: string; message: string }, values: Record<string, string>): DesignationFormState {
  if (error.code === "23505") {
    if (error.message.includes("designations_chauffeur_unique_par_jour")) {
      return { status: "error", formError: "Ce chauffeur est déjà désigné ce jour-là.", values };
    }
    if (error.message.includes("designations_materiel_unique_par_jour")) {
      return { status: "error", formError: "Ce matériel est déjà attribué à un autre chauffeur ce jour-là.", values };
    }
  }
  if (error.code === "42501" || error.message.includes("row-level security")) {
    return { status: "error", formError: "Tu n'as pas les droits pour cette opération.", values };
  }
  return { status: "error", formError: `Erreur base : ${error.message}`, values };
}

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

async function sendDesignationWhatsapp(designationId: string): Promise<void> {
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

  if (!d) return;

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
    return;
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

  const statut = result.ok ? "SENT" : result.skipped ? "SKIPPED" : "FAILED";
  await supabase
    .from("designations")
    .update({
      whatsapp_statut: statut,
      whatsapp_sent_at: result.ok ? new Date().toISOString() : null,
      whatsapp_error: result.ok ? null : (result.error ?? null),
      whatsapp_attempts: 1,
    })
    .eq("id", designationId);
}

// =============================================================================
// Création
// =============================================================================

export async function createDesignationAction(
  _prev: DesignationFormState,
  formData: FormData,
): Promise<DesignationFormState> {
  const values = readFormValues(formData);
  const parsed = parseFormData(values);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", formError: "Session expirée.", values };

  const d = parsed.data;

  // Snapshot de l'équipe par défaut du chauffeur au moment de la désignation
  const { data: chauffeur } = await supabase
    .from("chauffeurs")
    .select("equipe_id_defaut")
    .eq("id", d.chauffeur_id)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from("designations")
    .insert({
      tenant_id: d.tenant_id,
      chauffeur_id: d.chauffeur_id,
      materiel_roulant_id: d.materiel_roulant_id,
      date_designation: d.date_designation,
      equipe_id: chauffeur?.equipe_id_defaut ?? null,
      notes: d.notes,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !created) return mapDbErr(error ?? { message: "inconnue" }, values);

  // Envoi du WhatsApp (best-effort, ne bloque pas le succès)
  await sendDesignationWhatsapp(created.id);

  revalidatePath("/designations");
  revalidatePath("/planning");
  redirect(`/designations/${created.id}?created=1`);
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
