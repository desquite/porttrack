"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  materielRoulantCreateSchema,
  type MaterielRoulantCreateInput,
} from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";

// =============================================================================
// État partagé avec le composant client (useActionState)
// =============================================================================

export type MaterielFormState =
  | { status: "idle" }
  | {
      status: "error";
      formError?: string;
      fieldErrors?: Partial<Record<keyof MaterielRoulantCreateInput, string[]>>;
      values?: Partial<Record<string, string>>;
    };

// =============================================================================
// Helpers
// =============================================================================

function readFormValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    out[key] = String(value ?? "");
  }
  return out;
}

function mapDbErrorToFormState(
  error: { code?: string; message: string },
  values: Record<string, string>,
): MaterielFormState {
  if (error.code === "23505" && error.message.includes("immatriculation")) {
    return {
      status: "error",
      fieldErrors: {
        immatriculation: ["Un véhicule avec cette immatriculation existe déjà dans cette entreprise"],
      },
      values,
    };
  }
  if (error.code === "42501" || error.message.includes("row-level security")) {
    return {
      status: "error",
      formError: "Tu n'as pas les droits suffisants pour cette opération.",
      values,
    };
  }
  return {
    status: "error",
    formError: `Erreur base de données : ${error.message}`,
    values,
  };
}

function parseFormData(
  values: Record<string, string>,
): { ok: true; data: ReturnType<typeof materielRoulantCreateSchema.parse> } | { ok: false; state: MaterielFormState } {
  const parsed = materielRoulantCreateSchema.safeParse(values);
  if (parsed.success) return { ok: true, data: parsed.data };

  const fieldErrors: Partial<Record<keyof MaterielRoulantCreateInput, string[]>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as keyof MaterielRoulantCreateInput | undefined;
    if (!field) continue;
    const existing = fieldErrors[field] ?? [];
    existing.push(issue.message);
    fieldErrors[field] = existing;
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

// =============================================================================
// Server Action : création d'un matériel roulant
// =============================================================================

export async function createMaterielAction(
  _prev: MaterielFormState,
  formData: FormData,
): Promise<MaterielFormState> {
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

  const { error } = await supabase.from("materiel_roulant").insert({
    ...parsed.data,
    created_by: user.id,
  });

  if (error) {
    console.error("[createMaterielAction]", error);
    return mapDbErrorToFormState(error, values);
  }

  revalidatePath("/flotte");
  revalidatePath("/dashboard");
  redirect(`/flotte?created=${encodeURIComponent(parsed.data.immatriculation)}`);
}

// =============================================================================
// Server Action : mise à jour d'un matériel existant
// =============================================================================

export async function updateMaterielAction(
  materielId: string,
  _prev: MaterielFormState,
  formData: FormData,
): Promise<MaterielFormState> {
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

  const { error, data } = await supabase
    .from("materiel_roulant")
    .update(parsed.data)
    .eq("id", materielId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[updateMaterielAction]", error);
    return mapDbErrorToFormState(error, values);
  }

  if (!data) {
    return {
      status: "error",
      formError: "Véhicule introuvable ou tu n'as pas les droits pour le modifier.",
      values,
    };
  }

  revalidatePath("/flotte");
  revalidatePath(`/flotte/${materielId}`);
  revalidatePath("/dashboard");
  redirect(
    `/flotte/${materielId}?updated=${encodeURIComponent(parsed.data.immatriculation)}`,
  );
}

// =============================================================================
// Server Action : suppression d'un matériel
// =============================================================================
// RLS : la policy DELETE on materiel_roulant n'autorise que MANAGER + SUPER_ADMIN.

export async function deleteMaterielAction(materielId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: materiel } = await supabase
    .from("materiel_roulant")
    .select("immatriculation")
    .eq("id", materielId)
    .maybeSingle();

  const { error } = await supabase
    .from("materiel_roulant")
    .delete()
    .eq("id", materielId);

  if (error) {
    console.error("[deleteMaterielAction]", error);
    redirect(
      `/flotte/${materielId}?error=${encodeURIComponent(
        error.code === "42501" || error.message.includes("row-level security")
          ? "Tu n'as pas les droits pour supprimer ce véhicule (MANAGER requis)."
          : `Erreur de suppression : ${error.message}`,
      )}`,
    );
  }

  revalidatePath("/flotte");
  revalidatePath("/dashboard");

  const label = materiel?.immatriculation ?? "Véhicule";
  redirect(`/flotte?deleted=${encodeURIComponent(label)}`);
}
