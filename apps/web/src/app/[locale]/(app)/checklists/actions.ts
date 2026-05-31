"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import {
  checklistDepartCreateSchema,
  checklistDepartUpdateSchema,
  CHECKLIST_ITEM_ETATS,
  type ChecklistDepartCreateInput,
  type ChecklistItemEtat,
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

const ITEM_KEY_RE = /^item-([0-9a-f-]{36})$/i;

/**
 * Extrait les réponses items du FormData. Le format attendu côté formulaire
 * est `item-<uuid>` = "OK" | "ANOMALIE".
 *
 * Retourne un tableau de paires { itemConfigId, etat }.
 */
function extractItemResponses(values: Record<string, string>):
  | { ok: true; responses: Array<{ itemConfigId: string; etat: ChecklistItemEtat }> }
  | { ok: false; error: string } {
  const out: Array<{ itemConfigId: string; etat: ChecklistItemEtat }> = [];
  for (const [key, raw] of Object.entries(values)) {
    const m = key.match(ITEM_KEY_RE);
    if (!m) continue;
    const itemConfigId = m[1];
    if (!(CHECKLIST_ITEM_ETATS as readonly string[]).includes(raw)) {
      return { ok: false, error: `État invalide pour l'item ${itemConfigId} : ${raw}` };
    }
    out.push({ itemConfigId, etat: raw as ChecklistItemEtat });
  }
  return { ok: true, responses: out };
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
  const parsed = checklistDepartCreateSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof ChecklistDepartCreateInput, string[]>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof ChecklistDepartCreateInput | undefined;
      if (!field) continue;
      (fieldErrors[field] ??= []).push(issue.message);
    }
    return { status: "error", formError: "Corrige les champs en rouge.", fieldErrors, values };
  }

  const items = extractItemResponses(values);
  if (!items.ok) return { status: "error", formError: items.error, values };
  if (items.responses.length === 0) {
    return { status: "error", formError: "Aucun item configuré pour cette entreprise — demande au manager de les ajouter.", values };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", formError: "Session expirée.", values };

  const d = parsed.data;

  // 1) Création de la check-list
  const { data: created, error } = await supabase
    .from("checklists_depart")
    .insert({
      tenant_id: d.tenant_id,
      designation_id: d.designation_id,
      chauffeur_id: d.chauffeur_id,
      materiel_roulant_id: d.materiel_roulant_id,
      date_depart: d.date_depart,
      remarque: d.remarque,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error("[createChecklistAction]", error);
    return mapDbErr(error ?? { message: "inconnue" }, values);
  }

  // 2) Création des réponses items (le trigger recalcule statut_global)
  const responsesRows = items.responses.map((r) => ({
    tenant_id: d.tenant_id,
    checklist_id: created.id,
    item_config_id: r.itemConfigId,
    etat: r.etat,
  }));
  const { error: rerr } = await supabase.from("checklist_responses").insert(responsesRows);
  if (rerr) {
    // Compensation : la check-list seule a été créée, on la supprime pour éviter
    // un état incohérent (pas de réponses → statut FAITE par défaut faussé).
    await supabase.from("checklists_depart").delete().eq("id", created.id);
    console.error("[createChecklistAction:responses]", rerr);
    return mapDbErr(rerr, values);
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
  const parsed = checklistDepartUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      formError: "Remarque invalide.",
      values,
    };
  }

  const items = extractItemResponses(values);
  if (!items.ok) return { status: "error", formError: items.error, values };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", formError: "Session expirée.", values };

  // Récupère le tenant_id de la check-list (utile pour insérer de nouvelles réponses)
  const { data: cl } = await supabase
    .from("checklists_depart")
    .select("tenant_id")
    .eq("id", checklistId)
    .maybeSingle();
  if (!cl) return { status: "error", formError: "Check-list introuvable ou droits insuffisants.", values };

  // 1) Update remarque (le trigger sur remarque recalcule statut)
  const { error: uerr } = await supabase
    .from("checklists_depart")
    .update({ remarque: parsed.data.remarque })
    .eq("id", checklistId);
  if (uerr) return mapDbErr(uerr, values);

  // 2) Upsert des réponses item par item
  for (const r of items.responses) {
    const { error: rerr } = await supabase
      .from("checklist_responses")
      .upsert(
        {
          tenant_id: cl.tenant_id,
          checklist_id: checklistId,
          item_config_id: r.itemConfigId,
          etat: r.etat,
        },
        { onConflict: "checklist_id,item_config_id" },
      );
    if (rerr) return mapDbErr(rerr, values);
  }

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
