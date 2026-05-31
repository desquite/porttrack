"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  checklistItemConfigCreateSchema,
  checklistItemConfigUpdateSchema,
  type ChecklistItemConfigCreateInput,
} from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";

// =============================================================================
// État formulaire
// =============================================================================

export type ChecklistItemConfigFormState =
  | { status: "idle" }
  | {
      status: "error";
      formError?: string;
      fieldErrors?: Partial<Record<keyof ChecklistItemConfigCreateInput, string[]>>;
      values?: Partial<Record<string, string>>;
    };

function readFormValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  // Le toggle actif arrive en absence si décoché → on force "false"
  if (!("actif" in out)) out.actif = "false";
  return out;
}

function mapDbErr(error: { code?: string; message: string }, values: Record<string, string>): ChecklistItemConfigFormState {
  if (error.code === "23505" && error.message.includes("checklist_items_config_code_unique")) {
    return { status: "error", formError: "Ce code est déjà utilisé pour cette entreprise.", values };
  }
  if (error.code === "42501" || error.message.includes("row-level security")) {
    return { status: "error", formError: "Tu n'as pas les droits — réservé aux MANAGER.", values };
  }
  return { status: "error", formError: `Erreur base : ${error.message}`, values };
}

// =============================================================================
// Création
// =============================================================================

export async function createChecklistItemAction(
  _prev: ChecklistItemConfigFormState,
  formData: FormData,
): Promise<ChecklistItemConfigFormState> {
  const values = readFormValues(formData);
  const parsed = checklistItemConfigCreateSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof ChecklistItemConfigCreateInput, string[]>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof ChecklistItemConfigCreateInput | undefined;
      if (!field) continue;
      (fieldErrors[field] ??= []).push(issue.message);
    }
    return { status: "error", formError: "Corrige les champs en rouge.", fieldErrors, values };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", formError: "Session expirée.", values };

  const d = parsed.data;
  const { error } = await supabase
    .from("checklist_items_config")
    .insert({
      tenant_id: d.tenant_id,
      code: d.code,
      label: d.label,
      ordre: d.ordre,
      actif: d.actif,
      created_by: user.id,
    });

  if (error) return mapDbErr(error, values);

  revalidatePath("/parametres/checklist-items");
  redirect("/parametres/checklist-items?created=1");
}

// =============================================================================
// Mise à jour
// =============================================================================

export async function updateChecklistItemAction(
  itemId: string,
  _prev: ChecklistItemConfigFormState,
  formData: FormData,
): Promise<ChecklistItemConfigFormState> {
  const values = readFormValues(formData);
  const parsed = checklistItemConfigUpdateSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof ChecklistItemConfigCreateInput, string[]>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof ChecklistItemConfigCreateInput | undefined;
      if (!field) continue;
      (fieldErrors[field] ??= []).push(issue.message);
    }
    return { status: "error", formError: "Corrige les champs en rouge.", fieldErrors, values };
  }

  const supabase = await createClient();
  const d = parsed.data;
  const { error, data } = await supabase
    .from("checklist_items_config")
    .update({ label: d.label, ordre: d.ordre, actif: d.actif })
    .eq("id", itemId)
    .select("id")
    .maybeSingle();

  if (error) return mapDbErr(error, values);
  if (!data) return { status: "error", formError: "Item introuvable ou droits insuffisants.", values };

  revalidatePath("/parametres/checklist-items");
  revalidatePath(`/parametres/checklist-items/${itemId}`);
  redirect("/parametres/checklist-items?updated=1");
}

// =============================================================================
// Toggle actif (raccourci depuis la liste)
// =============================================================================

export async function toggleChecklistItemActifAction(itemId: string, newActif: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("checklist_items_config")
    .update({ actif: newActif })
    .eq("id", itemId);
  if (error) {
    redirect(`/parametres/checklist-items?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/parametres/checklist-items");
  redirect(`/parametres/checklist-items?updated=1`);
}

// =============================================================================
// Suppression (hard) — ne marche que si non utilisé (ON DELETE RESTRICT
// côté checklist_responses). En cas d'utilisation, l'utilisateur doit
// passer par le toggle actif=false (soft delete).
// =============================================================================

export async function deleteChecklistItemAction(itemId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("checklist_items_config").delete().eq("id", itemId);
  if (error) {
    const msg = error.code === "23503"
      ? "Cet item est référencé par au moins une check-list. Utilise plutôt « Désactiver » pour le cacher."
      : error.message;
    redirect(`/parametres/checklist-items?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/parametres/checklist-items");
  redirect("/parametres/checklist-items?deleted=1");
}
