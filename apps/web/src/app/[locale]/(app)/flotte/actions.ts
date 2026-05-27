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
// Helper
// =============================================================================

function readFormValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    out[key] = String(value ?? "");
  }
  return out;
}

// =============================================================================
// Server Action : création d'un matériel roulant
// =============================================================================

export async function createMaterielAction(
  _prev: MaterielFormState,
  formData: FormData,
): Promise<MaterielFormState> {
  const values = readFormValues(formData);

  // 1. Validation Zod
  const parsed = materielRoulantCreateSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof MaterielRoulantCreateInput, string[]>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof MaterielRoulantCreateInput | undefined;
      if (!field) continue;
      const existing = fieldErrors[field] ?? [];
      existing.push(issue.message);
      fieldErrors[field] = existing;
    }
    return {
      status: "error",
      formError: "Le formulaire contient des erreurs. Corrige les champs en rouge.",
      fieldErrors,
      values,
    };
  }

  // 2. Auth check (défense en profondeur)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      status: "error",
      formError: "Session expirée. Reconnecte-toi.",
      values,
    };
  }

  // 3. Insertion
  const { error } = await supabase.from("materiel_roulant").insert({
    ...parsed.data,
    created_by: user.id,
  });

  if (error) {
    // Erreurs DB connues
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
        formError: "Tu n'as pas les droits pour créer un véhicule dans cette entreprise.",
        values,
      };
    }
    console.error("[createMaterielAction]", error);
    return {
      status: "error",
      formError: `Erreur base de données : ${error.message}`,
      values,
    };
  }

  // 4. Succès
  revalidatePath("/flotte");
  revalidatePath("/dashboard");
  redirect(`/flotte?created=${encodeURIComponent(parsed.data.immatriculation)}`);
}
