"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { chauffeurCreateSchema, type ChauffeurCreateInput } from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";

// =============================================================================
// Types d'état partagés avec le composant client (useActionState)
// =============================================================================

export type ChauffeurFormState =
  | { status: "idle" }
  | {
      status: "error";
      // Erreur générale (non liée à un champ — ex. erreur Supabase, droits manquants)
      formError?: string;
      // Erreurs par champ (Zod) — la clé est le path du champ
      fieldErrors?: Partial<Record<keyof ChauffeurCreateInput, string[]>>;
      // On garde les valeurs saisies pour les ré-injecter dans le form après erreur
      values?: Partial<Record<string, string | string[]>>;
    };

// =============================================================================
// Helper : lit toutes les valeurs du FormData en gérant les checkbox arrays
// =============================================================================

function readFormValues(formData: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};

  // Champs avec valeurs multiples (checkboxes) — collectés via getAll()
  const MULTI_FIELDS = new Set(["categories_permis"]);

  for (const key of new Set(Array.from(formData.keys()))) {
    if (MULTI_FIELDS.has(key)) {
      out[key] = formData.getAll(key).map(String).filter(Boolean);
    } else {
      out[key] = String(formData.get(key) ?? "");
    }
  }

  // S'assurer qu'on a toujours une clé array pour les multi-fields, même vide
  for (const k of MULTI_FIELDS) {
    if (!(k in out)) out[k] = [];
  }

  return out;
}

// =============================================================================
// Server Action : création d'un chauffeur
// =============================================================================

export async function createChauffeurAction(
  _prev: ChauffeurFormState,
  formData: FormData,
): Promise<ChauffeurFormState> {
  const values = readFormValues(formData);

  // 1. Validation Zod (avec coercion + transforms)
  const parsed = chauffeurCreateSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof ChauffeurCreateInput, string[]>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof ChauffeurCreateInput | undefined;
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

  // 2. Vérification droits côté serveur (les RLS feront aussi la défense en profondeur)
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

  // 3. Insertion (created_by auto-rempli, RLS check le tenant_id)
  const { error } = await supabase.from("chauffeurs").insert({
    ...parsed.data,
    created_by: user.id,
  });

  if (error) {
    // Cas d'erreurs DB connus — on les traduit en messages métier compréhensibles
    if (error.code === "23505") {
      // unique_violation
      const field = error.message.includes("numero_cni")
        ? "numero_cni"
        : error.message.includes("numero_permis")
          ? "numero_permis"
          : null;
      if (field === "numero_cni") {
        return {
          status: "error",
          fieldErrors: { numero_cni: ["Un chauffeur avec cette CNI existe déjà dans cette entreprise"] },
          values,
        };
      }
      if (field === "numero_permis") {
        return {
          status: "error",
          fieldErrors: { numero_permis: ["Un chauffeur avec ce numéro de permis existe déjà"] },
          values,
        };
      }
    }
    if (error.code === "42501" || error.message.includes("row-level security")) {
      return {
        status: "error",
        formError: "Tu n'as pas les droits pour créer un chauffeur dans cette entreprise.",
        values,
      };
    }
    console.error("[createChauffeurAction]", error);
    return {
      status: "error",
      formError: `Erreur base de données : ${error.message}`,
      values,
    };
  }

  // 4. Succès — on invalide les caches et on redirige avec un flash
  revalidatePath("/chauffeurs");
  revalidatePath("/dashboard");
  redirect(`/chauffeurs?created=${encodeURIComponent(`${parsed.data.prenoms} ${parsed.data.nom}`)}`);
}
