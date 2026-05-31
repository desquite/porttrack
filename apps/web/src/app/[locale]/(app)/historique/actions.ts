"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import {
  modificationTraceeSchema,
  getTrackedField,
  JUSTIFICATIF_MIME,
  JUSTIFICATIF_MAX_SIZE,
  type ModificationTraceeInput,
} from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/notifications/email-resend";

// =============================================================================
// État formulaire
// =============================================================================

export type ModificationFormState =
  | { status: "idle" }
  | {
      status: "error";
      formError?: string;
      fieldErrors?: Partial<Record<keyof ModificationTraceeInput, string[]>>;
      values?: Partial<Record<string, string>>;
    };

function readFormValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100);
}

/** Formate une valeur brute en texte lisible pour l'historique. */
function formatForHistory(raw: string | null, type: string): string | null {
  if (raw === null || raw === "") return null;
  if (type === "datetime") {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? raw : d.toISOString();
  }
  return raw;
}

// =============================================================================
// Création d'une modification tracée
// =============================================================================

export async function createTrackedModificationAction(
  _prev: ModificationFormState,
  formData: FormData,
): Promise<ModificationFormState> {
  const values = readFormValues(formData);
  const parsed = modificationTraceeSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof ModificationTraceeInput, string[]>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof ModificationTraceeInput | undefined;
      if (!field) continue;
      (fieldErrors[field] ??= []).push(issue.message);
    }
    return { status: "error", formError: "Corrige les champs en rouge.", fieldErrors, values };
  }

  const d = parsed.data;

  // 1) Le champ doit être déclaré « traçable » pour cette table (whitelist)
  const field = getTrackedField(d.table_cible, d.champ);
  if (!field) {
    return { status: "error", formError: "Ce champ n'est pas modifiable via la traçabilité.", values };
  }

  // 2) Justificatif obligatoire (cahier §8.4 RÈGLE 1)
  const file = formData.get("justificatif");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", formError: "Un justificatif est obligatoire pour valider la modification.", values };
  }
  const f = file as File;
  if (f.size > JUSTIFICATIF_MAX_SIZE) {
    return { status: "error", formError: "Justificatif trop volumineux (10 Mo max).", values };
  }
  if (!(JUSTIFICATIF_MIME as readonly string[]).includes(f.type)) {
    return { status: "error", formError: `Format non autorisé (${f.type}). PDF, JPG, PNG, HEIC acceptés.`, values };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", formError: "Session expirée.", values };

  // 3) Lecture de la valeur avant modification
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: current, error: readErr } = await (supabase as any)
    .from(d.table_cible)
    .select(`id, ${d.champ}`)
    .eq("id", d.enregistrement_id)
    .maybeSingle();
  if (readErr || !current) {
    return { status: "error", formError: "Enregistrement introuvable ou droits insuffisants.", values };
  }
  // Valeurs BRUTES (ce qu'on applique réellement à la colonne) — pour un
  // select c'est l'UUID, pour le reste la valeur formatée.
  const valeurAvantBrute = formatForHistory(
    current[d.champ] === null || current[d.champ] === undefined ? null : String(current[d.champ]),
    field.type,
  );
  const valeurApresBrute = formatForHistory(d.valeur_apres, field.type);

  if (valeurAvantBrute === valeurApresBrute) {
    return { status: "error", formError: "La nouvelle valeur est identique à l'actuelle.", values };
  }

  // Valeurs AFFICHÉES dans l'historique — pour les selects, on stocke le
  // libellé humain (ex. nom du chauffeur) transmis par le formulaire plutôt
  // que l'UUID. Pour les autres types, identique à la valeur brute.
  const avantLabel = typeof values.valeur_avant_label === "string" && values.valeur_avant_label.trim() !== ""
    ? values.valeur_avant_label.trim() : null;
  const apresLabel = typeof values.valeur_apres_label === "string" && values.valeur_apres_label.trim() !== ""
    ? values.valeur_apres_label.trim() : null;
  const valeurAvantHist = field.type === "select" ? avantLabel : valeurAvantBrute;
  const valeurApresHist = field.type === "select" ? apresLabel : valeurApresBrute;

  // 4) Upload du justificatif
  const ext = f.name.split(".").pop()?.toLowerCase() ?? "bin";
  const base = sanitizeFilename(f.name.replace(/\.[^.]+$/, ""));
  const objectPath = `${d.tenant_id}/modifications/${d.enregistrement_id}/${randomUUID()}-${base}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("documents")
    .upload(objectPath, f, { cacheControl: "3600", contentType: f.type, upsert: false });
  if (upErr) {
    return { status: "error", formError: `Upload du justificatif : ${upErr.message}`, values };
  }

  // 5) Application de la modification sur la table cible (colonne whitelistée).
  //    On applique TOUJOURS la valeur brute (UUID pour un select, texte sinon).
  const patch: Record<string, string | null> = { [d.champ]: valeurApresBrute };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updErr } = await (supabase as any)
    .from(d.table_cible)
    .update(patch)
    .eq("id", d.enregistrement_id);
  if (updErr) {
    await supabase.storage.from("documents").remove([objectPath]);
    return { status: "error", formError: `Modification refusée : ${updErr.message}`, values };
  }

  // 6) Écriture de l'entrée d'historique IMMUABLE
  const { error: histErr } = await supabase.from("modifications_historique").insert({
    tenant_id: d.tenant_id,
    table_cible: d.table_cible,
    enregistrement_id: d.enregistrement_id,
    champ: d.champ,
    champ_label: field.label,
    valeur_avant: valeurAvantHist,
    valeur_apres: valeurApresHist,
    motif: d.motif,
    justificatif_url: objectPath,
    justificatif_nom: f.name,
    user_id: user.id,
    user_email: user.email ?? null,
  });
  if (histErr) {
    // La modif est passée mais l'historique a échoué : on nettoie le fichier et
    // on signale. (Cas rare ; on n'annule pas la modif déjà appliquée.)
    await supabase.storage.from("documents").remove([objectPath]);
    return { status: "error", formError: `Historique : ${histErr.message}`, values };
  }

  // 7) Notification email aux managers du tenant (best-effort, ne bloque pas)
  await notifyManagers(d.tenant_id, {
    champLabel: field.label,
    avant: valeurAvantHist,
    apres: valeurApresHist,
    motif: d.motif,
    auteur: user.email ?? "un utilisateur",
    table: d.table_cible,
  });

  revalidatePath(`/${d.table_cible}/${d.enregistrement_id}`);
  revalidatePath("/historique");
  redirect(`/${d.table_cible}/${d.enregistrement_id}?modtracee=1`);
}

// =============================================================================
// Notification email aux managers
// =============================================================================

async function notifyManagers(
  tenantId: string,
  info: { champLabel: string; avant: string | null; apres: string | null; motif: string; auteur: string; table: string },
): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: managers } = await supabase
      .from("users")
      .select("email")
      .eq("tenant_id", tenantId)
      .eq("role", "MANAGER")
      .eq("actif", true);

    const emails = (managers ?? []).map((m) => m.email).filter((e): e is string => !!e);
    if (emails.length === 0) return;

    const subject = `PORTTRACK — Modification tracée : ${info.champLabel}`;
    const textBody = [
      `Une modification justifiée a été enregistrée.`,
      ``,
      `Champ : ${info.champLabel}`,
      `Avant : ${info.avant ?? "(vide)"}`,
      `Après : ${info.apres ?? "(vide)"}`,
      `Motif : ${info.motif}`,
      `Par : ${info.auteur}`,
      ``,
      `Consultez le détail dans PORTTRACK → Traçabilité.`,
    ].join("\n");

    await Promise.all(
      emails.map((to) => sendEmail(to, { subject, textBody })),
    );
  } catch {
    // best-effort : une erreur de notification ne doit jamais faire échouer la modif
  }
}

// =============================================================================
// Téléchargement d'un justificatif (URL signée)
// =============================================================================

export async function downloadJustificatifAction(modificationId: string): Promise<void> {
  const supabase = await createClient();
  const { data: m } = await supabase
    .from("modifications_historique")
    .select("justificatif_url, justificatif_nom")
    .eq("id", modificationId)
    .maybeSingle();
  if (!m?.justificatif_url) redirect("/historique?error=Justificatif%20introuvable");

  const { data: signed, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(m!.justificatif_url, 60, { download: m!.justificatif_nom ?? undefined });
  if (error || !signed?.signedUrl) {
    redirect(`/historique?error=${encodeURIComponent(error?.message ?? "Lien indisponible")}`);
  }
  redirect(signed.signedUrl);
}
