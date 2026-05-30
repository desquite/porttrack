"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import {
  checklistDepartCreateSchema,
  checklistDepartUpdateSchema,
  type ChecklistDepartCreateInput,
  type ChecklistDepartUpdateInput,
} from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";

// =============================================================================
// État formulaire
// =============================================================================

export type ChecklistFormState =
  | { status: "idle" }
  | {
      status: "error";
      formError?: string;
      fieldErrors?: Partial<Record<keyof ChecklistDepartCreateInput, string[]>>;
      values?: Partial<Record<string, string>>;
    };

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME = [
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

function parseCreate(values: Record<string, string>) {
  const parsed = checklistDepartCreateSchema.safeParse(values);
  if (parsed.success) return { ok: true as const, data: parsed.data };
  const fieldErrors: Partial<Record<keyof ChecklistDepartCreateInput, string[]>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as keyof ChecklistDepartCreateInput | undefined;
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

function parseUpdate(values: Record<string, string>) {
  const parsed = checklistDepartUpdateSchema.safeParse(values);
  if (parsed.success) return { ok: true as const, data: parsed.data };
  const fieldErrors: Partial<Record<keyof ChecklistDepartUpdateInput, string[]>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as keyof ChecklistDepartUpdateInput | undefined;
    if (!field) continue;
    (fieldErrors[field] ??= []).push(issue.message);
  }
  return {
    ok: false as const,
    state: {
      status: "error" as const,
      formError: "Corrige les champs en rouge.",
      fieldErrors: fieldErrors as Partial<Record<keyof ChecklistDepartCreateInput, string[]>>,
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

function mapDbErr(error: { code?: string; message: string }, values: Record<string, string>): ChecklistFormState {
  if (error.code === "23505") {
    return {
      status: "error",
      formError: "Une check-list existe déjà pour cette désignation.",
      values,
    };
  }
  if (error.code === "42501" || error.message.includes("row-level security")) {
    return { status: "error", formError: "Tu n'as pas les droits pour cette opération.", values };
  }
  return { status: "error", formError: `Erreur base : ${error.message}`, values };
}

// =============================================================================
// Création
// =============================================================================

export async function createChecklistAction(
  _prev: ChecklistFormState,
  formData: FormData,
): Promise<ChecklistFormState> {
  const values = readFormValues(formData);
  const parsed = parseCreate(values);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", formError: "Session expirée.", values };

  const d = parsed.data;
  const { data: created, error } = await supabase
    .from("checklists_depart")
    .insert({
      tenant_id: d.tenant_id,
      designation_id: d.designation_id,
      chauffeur_id: d.chauffeur_id,
      materiel_roulant_id: d.materiel_roulant_id,
      date_depart: d.date_depart,
      item_huile: d.item_huile,
      item_pneus: d.item_pneus,
      item_feux: d.item_feux,
      item_freins: d.item_freins,
      item_retros: d.item_retros,
      item_documents: d.item_documents,
      remarque: d.remarque,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error("[createChecklistAction]", error);
    return mapDbErr(error ?? { message: "inconnue" }, values);
  }

  revalidatePath("/checklists");
  revalidatePath("/designations");
  revalidatePath("/dashboard");
  redirect(`/checklists/${created.id}?created=1`);
}

// =============================================================================
// Mise à jour
// =============================================================================

export async function updateChecklistAction(
  checklistId: string,
  _prev: ChecklistFormState,
  formData: FormData,
): Promise<ChecklistFormState> {
  const values = readFormValues(formData);
  const parsed = parseUpdate(values);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", formError: "Session expirée.", values };

  const d = parsed.data;
  const { data: updated, error } = await supabase
    .from("checklists_depart")
    .update({
      item_huile: d.item_huile,
      item_pneus: d.item_pneus,
      item_feux: d.item_feux,
      item_freins: d.item_freins,
      item_retros: d.item_retros,
      item_documents: d.item_documents,
      remarque: d.remarque,
    })
    .eq("id", checklistId)
    .select("id")
    .maybeSingle();

  if (error) return mapDbErr(error, values);
  if (!updated) return { status: "error", formError: "Check-list introuvable ou droits insuffisants.", values };

  revalidatePath("/checklists");
  revalidatePath(`/checklists/${checklistId}`);
  revalidatePath("/designations");
  revalidatePath("/dashboard");
  redirect(`/checklists/${checklistId}?updated=1`);
}

// =============================================================================
// Photos (multi-upload)
// =============================================================================

export async function addChecklistPhotoAction(
  checklistId: string,
  tenantId: string,
  formData: FormData,
): Promise<void> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/checklists/${checklistId}?error=${encodeURIComponent("Aucune photo reçue")}`);
  }
  const f = file as File;
  if (f.size > MAX_FILE_SIZE) {
    redirect(`/checklists/${checklistId}?error=${encodeURIComponent("Photo trop volumineuse (max 10 Mo)")}`);
  }
  if (!(ALLOWED_MIME as readonly string[]).includes(f.type)) {
    redirect(`/checklists/${checklistId}?error=${encodeURIComponent(`Type non autorisé : ${f.type}`)}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ext = f.name.split(".").pop()?.toLowerCase() ?? "bin";
  const base = sanitizeFilename(f.name.replace(/\.[^.]+$/, ""));
  const objectPath = `${tenantId}/checklists/${checklistId}/photo-${randomUUID()}-${base}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("documents")
    .upload(objectPath, f, { cacheControl: "3600", contentType: f.type, upsert: false });
  if (upErr) {
    redirect(`/checklists/${checklistId}?error=${encodeURIComponent(`Upload : ${upErr.message}`)}`);
  }

  const { error: dbErr } = await supabase.from("checklist_photos").insert({
    checklist_id: checklistId,
    tenant_id: tenantId,
    photo_url: objectPath,
    photo_nom: f.name,
    uploaded_by: user.id,
  });
  if (dbErr) {
    await supabase.storage.from("documents").remove([objectPath]);
    redirect(`/checklists/${checklistId}?error=${encodeURIComponent(`Erreur : ${dbErr.message}`)}`);
  }

  revalidatePath(`/checklists/${checklistId}`);
  redirect(`/checklists/${checklistId}?photoAdded=1`);
}

export async function deleteChecklistPhotoAction(photoId: string, checklistId: string): Promise<void> {
  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("checklist_photos")
    .select("photo_url")
    .eq("id", photoId)
    .maybeSingle();

  const { error } = await supabase.from("checklist_photos").delete().eq("id", photoId);
  if (error) {
    redirect(`/checklists/${checklistId}?error=${encodeURIComponent(error.message)}`);
  }
  if (photo?.photo_url) {
    await supabase.storage.from("documents").remove([photo.photo_url]);
  }
  revalidatePath(`/checklists/${checklistId}`);
  redirect(`/checklists/${checklistId}?photoDeleted=1`);
}

export async function downloadChecklistPhotoAction(photoId: string): Promise<void> {
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("checklist_photos")
    .select("photo_url, photo_nom, checklist_id")
    .eq("id", photoId)
    .maybeSingle();
  if (!p?.photo_url) redirect("/checklists");

  const { data: signed, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(p.photo_url, 60, { download: p.photo_nom ?? undefined });
  if (error || !signed?.signedUrl) {
    redirect(`/checklists/${p.checklist_id}?error=${encodeURIComponent(error?.message ?? "Lien indisponible")}`);
  }
  redirect(signed.signedUrl);
}

// =============================================================================
// Suppression
// =============================================================================

export async function deleteChecklistAction(checklistId: string): Promise<void> {
  const supabase = await createClient();

  const { data: photos } = await supabase
    .from("checklist_photos")
    .select("photo_url")
    .eq("checklist_id", checklistId);

  const { error } = await supabase.from("checklists_depart").delete().eq("id", checklistId);
  if (error) {
    redirect(`/checklists/${checklistId}?error=${encodeURIComponent(`Erreur : ${error.message}`)}`);
  }

  const toRemove = (photos ?? []).map((p) => p.photo_url).filter((p): p is string => !!p);
  if (toRemove.length > 0) {
    await supabase.storage.from("documents").remove(toRemove);
  }

  revalidatePath("/checklists");
  revalidatePath("/designations");
  revalidatePath("/dashboard");
  redirect("/checklists?deleted=1");
}
