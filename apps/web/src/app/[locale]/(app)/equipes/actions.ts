"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { equipeCreateSchema, type EquipeCreateInput } from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";

export type EquipeFormState =
  | { status: "idle" }
  | {
      status: "error";
      formError?: string;
      fieldErrors?: Partial<Record<keyof EquipeCreateInput, string[]>>;
      values?: Partial<Record<string, string>>;
    };

function readFormValues(formData: FormData): {
  values: Record<string, string>;
  jours_travailles: string[];
} {
  const values: Record<string, string> = {};
  const jours: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    if (key === "jours_travailles") {
      jours.push(value);
    } else {
      values[key] = value;
    }
  }
  return { values, jours_travailles: jours };
}

function parseFormData(
  values: Record<string, string>,
  jours_travailles: string[],
) {
  const parsed = equipeCreateSchema.safeParse({ ...values, jours_travailles });
  if (parsed.success) return { ok: true as const, data: parsed.data };
  const fieldErrors: Partial<Record<keyof EquipeCreateInput, string[]>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as keyof EquipeCreateInput | undefined;
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

function mapDbErr(
  error: { code?: string; message: string },
  values: Record<string, string>,
): EquipeFormState {
  if (error.code === "23505" && error.message.includes("code")) {
    return { status: "error", fieldErrors: { code: ["Ce code est déjà utilisé"] }, values };
  }
  if (error.code === "42501" || error.message.includes("row-level security")) {
    return { status: "error", formError: "Tu n'as pas les droits pour cette opération.", values };
  }
  return { status: "error", formError: `Erreur base : ${error.message}`, values };
}

// =============================================================================
// Création
// =============================================================================

export async function createEquipeAction(
  _prev: EquipeFormState,
  formData: FormData,
): Promise<EquipeFormState> {
  const { values, jours_travailles } = readFormValues(formData);
  const parsed = parseFormData(values, jours_travailles);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", formError: "Session expirée.", values };

  const d = parsed.data;
  const { data: created, error } = await supabase
    .from("equipes")
    .insert({
      tenant_id: d.tenant_id,
      nom: d.nom,
      code: d.code,
      heure_debut: d.heure_debut,
      heure_fin: d.heure_fin,
      jours_travailles: d.jours_travailles,
      couleur: d.couleur,
      ordre: d.ordre,
      actif: d.actif,
      notes: d.notes,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !created) return mapDbErr(error ?? { message: "inconnue" }, values);

  revalidatePath("/equipes");
  revalidatePath("/planning");
  revalidatePath("/chauffeurs");
  redirect(`/equipes/${created.id}?created=1`);
}

// =============================================================================
// Mise à jour
// =============================================================================

export async function updateEquipeAction(
  equipeId: string,
  _prev: EquipeFormState,
  formData: FormData,
): Promise<EquipeFormState> {
  const { values, jours_travailles } = readFormValues(formData);
  const parsed = parseFormData(values, jours_travailles);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", formError: "Session expirée.", values };

  const d = parsed.data;
  const { data: updated, error } = await supabase
    .from("equipes")
    .update({
      nom: d.nom,
      code: d.code,
      heure_debut: d.heure_debut,
      heure_fin: d.heure_fin,
      jours_travailles: d.jours_travailles,
      couleur: d.couleur,
      ordre: d.ordre,
      actif: d.actif,
      notes: d.notes,
    })
    .eq("id", equipeId)
    .select("id")
    .maybeSingle();

  if (error) return mapDbErr(error, values);
  if (!updated) return { status: "error", formError: "Équipe introuvable ou droits insuffisants.", values };

  revalidatePath("/equipes");
  revalidatePath(`/equipes/${equipeId}`);
  revalidatePath("/planning");
  revalidatePath("/chauffeurs");
  redirect(`/equipes/${equipeId}?updated=1`);
}

// =============================================================================
// Suppression
// =============================================================================

export async function deleteEquipeAction(equipeId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("equipes").delete().eq("id", equipeId);
  if (error) {
    redirect(`/equipes/${equipeId}?error=${encodeURIComponent(
      error.code === "42501" || error.message.includes("row-level security")
        ? "Suppression réservée aux MANAGER."
        : `Erreur : ${error.message}`,
    )}`);
  }
  revalidatePath("/equipes");
  revalidatePath("/planning");
  revalidatePath("/chauffeurs");
  redirect("/equipes?deleted=1");
}
