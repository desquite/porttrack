"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import {
  ACCIDENT_STATUTS,
  accidentCreateSchema,
  type AccidentCreateInput,
  type AccidentStatut,
} from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";

// =============================================================================
// État formulaire
// =============================================================================

export type AccidentFormState =
  | { status: "idle" }
  | {
      status: "error";
      formError?: string;
      fieldErrors?: Partial<Record<keyof AccidentCreateInput, string[]>>;
      values?: Partial<Record<string, string>>;
    };

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
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

function parseFormData(values: Record<string, string>) {
  const parsed = accidentCreateSchema.safeParse(values);
  if (parsed.success) return { ok: true as const, data: parsed.data };

  const fieldErrors: Partial<Record<keyof AccidentCreateInput, string[]>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as keyof AccidentCreateInput | undefined;
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

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100);
}

function mapDbErr(error: { code?: string; message: string }, values: Record<string, string>): AccidentFormState {
  if (error.code === "42501" || error.message.includes("row-level security")) {
    return { status: "error", formError: "Tu n'as pas les droits pour cette opération.", values };
  }
  return { status: "error", formError: `Erreur base : ${error.message}`, values };
}

// =============================================================================
// Création
// =============================================================================

export async function createAccidentAction(
  _prev: AccidentFormState,
  formData: FormData,
): Promise<AccidentFormState> {
  const values = readFormValues(formData);
  const parsed = parseFormData(values);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", formError: "Session expirée.", values };

  const d = parsed.data;
  const { data: created, error } = await supabase
    .from("accidents")
    .insert({
      tenant_id: d.tenant_id,
      materiel_roulant_id: d.materiel_roulant_id,
      chauffeur_id: d.chauffeur_id,
      date_accident: d.date_accident,
      lieu_accident: d.lieu_accident,
      circonstances: d.circonstances,
      tiers_implique: d.tiers_implique,
      assurance_ref: d.assurance_ref,
      date_declaration_assurance: d.date_declaration_assurance,
      franchise_fcfa: d.franchise_fcfa,
      remboursement_fcfa: d.remboursement_fcfa,
      statut: d.statut,
      notes: d.notes,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error("[createAccidentAction]", error);
    return mapDbErr(error ?? { message: "inconnue" }, values);
  }

  revalidatePath("/accidents");
  revalidatePath("/flotte");
  revalidatePath("/pannes");
  revalidatePath("/dashboard");
  redirect(`/accidents/${created.id}?created=1`);
}

// =============================================================================
// Mise à jour
// =============================================================================

export async function updateAccidentAction(
  accidentId: string,
  _prev: AccidentFormState,
  formData: FormData,
): Promise<AccidentFormState> {
  const values = readFormValues(formData);
  const parsed = parseFormData(values);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", formError: "Session expirée.", values };

  const d = parsed.data;
  const { data: updated, error } = await supabase
    .from("accidents")
    .update({
      materiel_roulant_id: d.materiel_roulant_id,
      chauffeur_id: d.chauffeur_id,
      date_accident: d.date_accident,
      lieu_accident: d.lieu_accident,
      circonstances: d.circonstances,
      tiers_implique: d.tiers_implique,
      assurance_ref: d.assurance_ref,
      date_declaration_assurance: d.date_declaration_assurance,
      franchise_fcfa: d.franchise_fcfa,
      remboursement_fcfa: d.remboursement_fcfa,
      statut: d.statut,
      notes: d.notes,
    })
    .eq("id", accidentId)
    .select("id")
    .maybeSingle();

  if (error) return mapDbErr(error, values);
  if (!updated) return { status: "error", formError: "Accident introuvable ou droits insuffisants.", values };

  revalidatePath("/accidents");
  revalidatePath(`/accidents/${accidentId}`);
  revalidatePath("/flotte");
  revalidatePath("/pannes");
  revalidatePath("/dashboard");
  redirect(`/accidents/${accidentId}?updated=1`);
}

// =============================================================================
// Transition rapide de statut
// =============================================================================

export async function changeAccidentStatutAction(
  accidentId: string,
  newStatut: AccidentStatut,
): Promise<void> {
  if (!(ACCIDENT_STATUTS as readonly string[]).includes(newStatut)) {
    redirect(`/accidents/${accidentId}?error=${encodeURIComponent("Statut invalide")}`);
  }
  const supabase = await createClient();
  const { error, data } = await supabase
    .from("accidents")
    .update({ statut: newStatut })
    .eq("id", accidentId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirect(`/accidents/${accidentId}?error=${encodeURIComponent(error?.message ?? "Mise à jour impossible")}`);
  }

  revalidatePath("/accidents");
  revalidatePath(`/accidents/${accidentId}`);
  revalidatePath("/flotte");
  redirect(`/accidents/${accidentId}?updated=1`);
}

// =============================================================================
// Helpers upload / download (générique pour constat & quittance)
// =============================================================================

async function uploadAccidentDoc(
  accidentId: string,
  tenantId: string,
  formData: FormData,
  field: "constat" | "quittance",
): Promise<void> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/accidents/${accidentId}?error=${encodeURIComponent("Aucun fichier reçu")}`);
  }
  const f = file as File;
  if (f.size > MAX_FILE_SIZE) {
    redirect(`/accidents/${accidentId}?error=${encodeURIComponent(`Fichier trop volumineux (${(f.size / 1024 / 1024).toFixed(1)} Mo)`)}`);
  }
  if (!(ALLOWED_MIME as readonly string[]).includes(f.type)) {
    redirect(`/accidents/${accidentId}?error=${encodeURIComponent(`Type non autorisé (${f.type})`)}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ext = f.name.split(".").pop()?.toLowerCase() ?? "bin";
  const base = sanitizeFilename(f.name.replace(/\.[^.]+$/, ""));
  const objectPath = `${tenantId}/accidents/${accidentId}/${field}-${randomUUID()}-${base}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("documents")
    .upload(objectPath, f, { cacheControl: "3600", contentType: f.type, upsert: false });
  if (upErr) {
    redirect(`/accidents/${accidentId}?error=${encodeURIComponent(`Upload : ${upErr.message}`)}`);
  }

  const { data: prev } = await supabase
    .from("accidents")
    .select("constat_url, quittance_url")
    .eq("id", accidentId)
    .maybeSingle();
  const prevPath = field === "constat" ? prev?.constat_url : prev?.quittance_url;

  const patch = field === "constat"
    ? { constat_url: objectPath, constat_nom: f.name }
    : { quittance_url: objectPath, quittance_nom: f.name };
  const { error: dbErr } = await supabase
    .from("accidents")
    .update(patch)
    .eq("id", accidentId);
  if (dbErr) {
    await supabase.storage.from("documents").remove([objectPath]);
    redirect(`/accidents/${accidentId}?error=${encodeURIComponent(`Erreur : ${dbErr.message}`)}`);
  }

  if (prevPath && prevPath !== objectPath) {
    await supabase.storage.from("documents").remove([prevPath]);
  }

  revalidatePath(`/accidents/${accidentId}`);
  redirect(`/accidents/${accidentId}?uploaded=${field}`);
}

export async function uploadConstatAction(accidentId: string, tenantId: string, formData: FormData) {
  return uploadAccidentDoc(accidentId, tenantId, formData, "constat");
}
export async function uploadQuittanceAction(accidentId: string, tenantId: string, formData: FormData) {
  return uploadAccidentDoc(accidentId, tenantId, formData, "quittance");
}

async function downloadAccidentDoc(accidentId: string, field: "constat" | "quittance"): Promise<void> {
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("accidents")
    .select("constat_url, constat_nom, quittance_url, quittance_nom")
    .eq("id", accidentId)
    .maybeSingle();
  const path = field === "constat" ? a?.constat_url : a?.quittance_url;
  const nom  = field === "constat" ? a?.constat_nom : a?.quittance_nom;
  if (!path) redirect(`/accidents/${accidentId}?error=${encodeURIComponent("Aucun fichier")}`);

  const { data: signed, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(path!, 60, { download: nom ?? undefined });
  if (error || !signed?.signedUrl) {
    redirect(`/accidents/${accidentId}?error=${encodeURIComponent(error?.message ?? "Lien indisponible")}`);
  }
  redirect(signed.signedUrl);
}

export const downloadConstatAction = (accidentId: string) => downloadAccidentDoc(accidentId, "constat");
export const downloadQuittanceAction = (accidentId: string) => downloadAccidentDoc(accidentId, "quittance");

// =============================================================================
// Photos de dégâts (multi-upload)
// =============================================================================

export async function addAccidentPhotoAction(
  accidentId: string,
  tenantId: string,
  formData: FormData,
): Promise<void> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/accidents/${accidentId}?error=${encodeURIComponent("Aucune photo reçue")}`);
  }
  const f = file as File;
  if (f.size > MAX_FILE_SIZE) {
    redirect(`/accidents/${accidentId}?error=${encodeURIComponent("Photo trop volumineuse (max 10 Mo)")}`);
  }
  if (!(ALLOWED_MIME as readonly string[]).includes(f.type)) {
    redirect(`/accidents/${accidentId}?error=${encodeURIComponent(`Type non autorisé : ${f.type}`)}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ext = f.name.split(".").pop()?.toLowerCase() ?? "bin";
  const base = sanitizeFilename(f.name.replace(/\.[^.]+$/, ""));
  const objectPath = `${tenantId}/accidents/${accidentId}/photo-${randomUUID()}-${base}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("documents")
    .upload(objectPath, f, { cacheControl: "3600", contentType: f.type, upsert: false });
  if (upErr) {
    redirect(`/accidents/${accidentId}?error=${encodeURIComponent(`Upload : ${upErr.message}`)}`);
  }

  const { error: dbErr } = await supabase.from("accident_photos").insert({
    accident_id: accidentId,
    tenant_id: tenantId,
    photo_url: objectPath,
    photo_nom: f.name,
    uploaded_by: user.id,
  });
  if (dbErr) {
    await supabase.storage.from("documents").remove([objectPath]);
    redirect(`/accidents/${accidentId}?error=${encodeURIComponent(`Erreur : ${dbErr.message}`)}`);
  }

  revalidatePath(`/accidents/${accidentId}`);
  redirect(`/accidents/${accidentId}?photoAdded=1`);
}

export async function deleteAccidentPhotoAction(photoId: string, accidentId: string): Promise<void> {
  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("accident_photos")
    .select("photo_url")
    .eq("id", photoId)
    .maybeSingle();

  const { error } = await supabase.from("accident_photos").delete().eq("id", photoId);
  if (error) {
    redirect(`/accidents/${accidentId}?error=${encodeURIComponent(error.message)}`);
  }
  if (photo?.photo_url) {
    await supabase.storage.from("documents").remove([photo.photo_url]);
  }
  revalidatePath(`/accidents/${accidentId}`);
  redirect(`/accidents/${accidentId}?photoDeleted=1`);
}

export async function downloadAccidentPhotoAction(photoId: string): Promise<void> {
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("accident_photos")
    .select("photo_url, photo_nom, accident_id")
    .eq("id", photoId)
    .maybeSingle();
  if (!p?.photo_url) redirect("/accidents");

  const { data: signed, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(p.photo_url, 60, { download: p.photo_nom ?? undefined });
  if (error || !signed?.signedUrl) {
    redirect(`/accidents/${p.accident_id}?error=${encodeURIComponent(error?.message ?? "Lien indisponible")}`);
  }
  redirect(signed.signedUrl);
}

// =============================================================================
// Suppression
// =============================================================================

export async function deleteAccidentAction(accidentId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Récupère les paths à nettoyer dans Storage
  const { data: a } = await supabase
    .from("accidents")
    .select("constat_url, quittance_url")
    .eq("id", accidentId)
    .maybeSingle();
  const { data: photos } = await supabase
    .from("accident_photos")
    .select("photo_url")
    .eq("accident_id", accidentId);

  const { error } = await supabase.from("accidents").delete().eq("id", accidentId);
  if (error) {
    redirect(
      `/accidents/${accidentId}?error=${encodeURIComponent(
        error.code === "42501" || error.message.includes("row-level security")
          ? "Suppression réservée aux MANAGER."
          : `Erreur : ${error.message}`,
      )}`,
    );
  }

  const toRemove = [
    a?.constat_url ?? null,
    a?.quittance_url ?? null,
    ...(photos ?? []).map((p) => p.photo_url),
  ].filter((p): p is string => !!p);
  if (toRemove.length > 0) {
    await supabase.storage.from("documents").remove(toRemove);
  }

  revalidatePath("/accidents");
  revalidatePath("/flotte");
  revalidatePath("/dashboard");
  redirect("/accidents?deleted=1");
}
