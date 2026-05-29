"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import {
  PANNE_STATUTS,
  panneCreateSchema,
  type PanneCreateInput,
  type PanneStatut,
} from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";

// =============================================================================
// État formulaire (useActionState)
// =============================================================================

export type PanneFormState =
  | { status: "idle" }
  | {
      status: "error";
      formError?: string;
      fieldErrors?: Partial<Record<keyof PanneCreateInput, string[]>>;
      values?: Partial<Record<string, string>>;
    };

// Limites alignées sur le bucket Supabase Storage (documents)
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

// =============================================================================
// Helpers
// =============================================================================

function readFormValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function parseFormData(
  values: Record<string, string>,
):
  | { ok: true; data: ReturnType<typeof panneCreateSchema.parse> }
  | { ok: false; state: PanneFormState } {
  const parsed = panneCreateSchema.safeParse(values);
  if (parsed.success) return { ok: true, data: parsed.data };

  const fieldErrors: Partial<Record<keyof PanneCreateInput, string[]>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as keyof PanneCreateInput | undefined;
    if (!field) continue;
    (fieldErrors[field] ??= []).push(issue.message);
  }
  return {
    ok: false,
    state: {
      status: "error",
      formError: "Le formulaire contient des erreurs. Corrige les champs en rouge.",
      fieldErrors,
      values,
    },
  };
}

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100);
}

function mapDbErrorToFormState(
  error: { code?: string; message: string },
  values: Record<string, string>,
): PanneFormState {
  if (error.code === "42501" || error.message.includes("row-level security")) {
    return {
      status: "error",
      formError: "Tu n'as pas les droits pour cette opération.",
      values,
    };
  }
  return {
    status: "error",
    formError: `Erreur base de données : ${error.message}`,
    values,
  };
}

// =============================================================================
// Création
// =============================================================================

export async function createPanneAction(
  _prev: PanneFormState,
  formData: FormData,
): Promise<PanneFormState> {
  const values = readFormValues(formData);
  const parsed = parseFormData(values);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", formError: "Session expirée. Reconnecte-toi.", values };
  }

  const data = parsed.data;
  // Cohérence métier : si on déclare directement en EN_REPARATION sans date,
  // on initialise date_debut_reparation à aujourd'hui.
  const today = new Date().toISOString().slice(0, 10);

  const { data: created, error } = await supabase
    .from("pannes")
    .insert({
      tenant_id: data.tenant_id,
      materiel_roulant_id: data.materiel_roulant_id,
      date_declaration: data.date_declaration ?? today,
      description: data.description,
      type_panne: data.type_panne,
      garage: data.garage,
      date_debut_reparation:
        data.statut === "EN_REPARATION" && !data.date_debut_reparation
          ? today
          : data.date_debut_reparation,
      date_fin_reparation:
        data.statut === "REPAREE" && !data.date_fin_reparation
          ? today
          : data.date_fin_reparation,
      cout_estime_fcfa: data.cout_estime_fcfa,
      cout_reel_fcfa: data.cout_reel_fcfa,
      statut: data.statut,
      notes: data.notes,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error("[createPanneAction]", error);
    return mapDbErrorToFormState(error ?? { message: "inconnue" }, values);
  }

  revalidatePath("/pannes");
  revalidatePath("/flotte");
  revalidatePath("/dashboard");
  redirect(`/pannes/${created.id}?created=1`);
}

// =============================================================================
// Mise à jour
// =============================================================================

export async function updatePanneAction(
  panneId: string,
  _prev: PanneFormState,
  formData: FormData,
): Promise<PanneFormState> {
  const values = readFormValues(formData);
  const parsed = parseFormData(values);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", formError: "Session expirée. Reconnecte-toi.", values };
  }

  const data = parsed.data;
  const today = new Date().toISOString().slice(0, 10);

  const { data: updated, error } = await supabase
    .from("pannes")
    .update({
      tenant_id: data.tenant_id,
      materiel_roulant_id: data.materiel_roulant_id,
      date_declaration: data.date_declaration ?? today,
      description: data.description,
      type_panne: data.type_panne,
      garage: data.garage,
      date_debut_reparation:
        data.statut === "EN_REPARATION" && !data.date_debut_reparation
          ? today
          : data.date_debut_reparation,
      date_fin_reparation:
        data.statut === "REPAREE" && !data.date_fin_reparation
          ? today
          : data.date_fin_reparation,
      cout_estime_fcfa: data.cout_estime_fcfa,
      cout_reel_fcfa: data.cout_reel_fcfa,
      statut: data.statut,
      notes: data.notes,
    })
    .eq("id", panneId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[updatePanneAction]", error);
    return mapDbErrorToFormState(error, values);
  }
  if (!updated) {
    return {
      status: "error",
      formError: "Panne introuvable ou tu n'as pas les droits pour la modifier.",
      values,
    };
  }

  revalidatePath("/pannes");
  revalidatePath(`/pannes/${panneId}`);
  revalidatePath("/flotte");
  revalidatePath("/dashboard");
  redirect(`/pannes/${panneId}?updated=1`);
}

// =============================================================================
// Transition rapide de statut (boutons « Marquer en réparation / réparée »)
// =============================================================================

export async function changePanneStatutAction(
  panneId: string,
  newStatut: PanneStatut,
): Promise<void> {
  if (!(PANNE_STATUTS as readonly string[]).includes(newStatut)) {
    redirect(`/pannes/${panneId}?error=${encodeURIComponent("Statut invalide")}`);
  }

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { error, data } = await supabase
    .from("pannes")
    .update({
      statut: newStatut,
      ...(newStatut === "EN_REPARATION" ? { date_debut_reparation: today } : {}),
      ...(newStatut === "REPAREE" ? { date_fin_reparation: today } : {}),
    })
    .eq("id", panneId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.error("[changePanneStatutAction]", error);
    redirect(
      `/pannes/${panneId}?error=${encodeURIComponent(error?.message ?? "Mise à jour impossible")}`,
    );
  }

  revalidatePath("/pannes");
  revalidatePath(`/pannes/${panneId}`);
  revalidatePath("/flotte");
  revalidatePath("/dashboard");
  redirect(`/pannes/${panneId}?updated=1`);
}

// =============================================================================
// Upload facture de réparation (vers Storage `documents`)
// =============================================================================

export async function uploadFactureAction(
  panneId: string,
  tenantId: string,
  formData: FormData,
): Promise<void> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/pannes/${panneId}?error=${encodeURIComponent("Aucun fichier reçu")}`);
  }
  const f = file as File;
  if (f.size > MAX_FILE_SIZE) {
    redirect(
      `/pannes/${panneId}?error=${encodeURIComponent(
        `Fichier trop volumineux (${(f.size / 1024 / 1024).toFixed(1)} Mo) — max 10 Mo`,
      )}`,
    );
  }
  if (!(ALLOWED_MIME as readonly string[]).includes(f.type)) {
    redirect(
      `/pannes/${panneId}?error=${encodeURIComponent(
        `Type de fichier non autorisé (${f.type}). Accepté : PDF, JPEG, PNG, WEBP.`,
      )}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ext = f.name.split(".").pop()?.toLowerCase() ?? "bin";
  const baseName = sanitizeFilename(f.name.replace(/\.[^.]+$/, ""));
  const objectPath = `${tenantId}/pannes/${panneId}/${randomUUID()}-${baseName}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("documents")
    .upload(objectPath, f, { cacheControl: "3600", contentType: f.type, upsert: false });
  if (uploadErr) {
    console.error("[uploadFactureAction] storage", uploadErr);
    redirect(
      `/pannes/${panneId}?error=${encodeURIComponent(`Échec d'upload : ${uploadErr.message}`)}`,
    );
  }

  // Remplace l'ancienne facture si présente
  const { data: prev } = await supabase
    .from("pannes")
    .select("facture_url")
    .eq("id", panneId)
    .maybeSingle();

  const { error: dbErr } = await supabase
    .from("pannes")
    .update({ facture_url: objectPath, facture_nom: f.name })
    .eq("id", panneId);

  if (dbErr) {
    await supabase.storage.from("documents").remove([objectPath]);
    console.error("[uploadFactureAction] db", dbErr);
    redirect(
      `/pannes/${panneId}?error=${encodeURIComponent(`Erreur base : ${dbErr.message}`)}`,
    );
  }

  if (prev?.facture_url && prev.facture_url !== objectPath) {
    await supabase.storage.from("documents").remove([prev.facture_url]);
  }

  revalidatePath(`/pannes/${panneId}`);
  redirect(`/pannes/${panneId}?factureUploaded=1`);
}

// =============================================================================
// Téléchargement facture (URL signée 60s)
// =============================================================================

export async function downloadFactureAction(panneId: string): Promise<void> {
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("pannes")
    .select("facture_url, facture_nom")
    .eq("id", panneId)
    .maybeSingle();

  if (!p?.facture_url) {
    redirect(`/pannes/${panneId}?error=${encodeURIComponent("Aucune facture")}`);
  }

  const { data: signed, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(p!.facture_url, 60, {
      download: p!.facture_nom ?? undefined,
    });
  if (error || !signed?.signedUrl) {
    redirect(
      `/pannes/${panneId}?error=${encodeURIComponent(`Lien indisponible : ${error?.message ?? "inconnu"}`)}`,
    );
  }
  redirect(signed.signedUrl);
}

// =============================================================================
// Suppression
// =============================================================================

export async function deletePanneAction(panneId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Récupère le path de la facture éventuelle pour la supprimer du Storage
  const { data: p } = await supabase
    .from("pannes")
    .select("facture_url")
    .eq("id", panneId)
    .maybeSingle();

  const { error } = await supabase.from("pannes").delete().eq("id", panneId);

  if (error) {
    console.error("[deletePanneAction]", error);
    redirect(
      `/pannes/${panneId}?error=${encodeURIComponent(
        error.code === "42501" || error.message.includes("row-level security")
          ? "Suppression réservée aux MANAGER."
          : `Erreur de suppression : ${error.message}`,
      )}`,
    );
  }

  if (p?.facture_url) {
    await supabase.storage.from("documents").remove([p.facture_url]);
  }

  revalidatePath("/pannes");
  revalidatePath("/flotte");
  revalidatePath("/dashboard");
  redirect("/pannes?deleted=1");
}
