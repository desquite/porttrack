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

/**
 * Traduction des erreurs Supabase courantes en messages utilisateur FR.
 * Centralisée pour rester cohérente entre create et update.
 */
function mapDbErrorToFormState(
  error: { code?: string; message: string },
  values: Record<string, string | string[]>,
): ChauffeurFormState {
  if (error.code === "23505") {
    // unique_violation — on devine quel constraint a déclenché via le message
    if (error.message.includes("numero_cni")) {
      return {
        status: "error",
        fieldErrors: {
          numero_cni: ["Un chauffeur avec cette CNI existe déjà dans cette entreprise"],
        },
        values,
      };
    }
    if (error.message.includes("numero_permis")) {
      return {
        status: "error",
        fieldErrors: {
          numero_permis: ["Un chauffeur avec ce numéro de permis existe déjà"],
        },
        values,
      };
    }
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
    return { status: "error", formError: "Session expirée. Reconnecte-toi.", values };
  }

  // 3. Insertion
  const { error } = await supabase.from("chauffeurs").insert({
    ...parsed.data,
    created_by: user.id,
  });

  if (error) {
    console.error("[createChauffeurAction]", error);
    return mapDbErrorToFormState(error, values);
  }

  // 4. Succès
  revalidatePath("/chauffeurs");
  revalidatePath("/dashboard");
  redirect(
    `/chauffeurs?created=${encodeURIComponent(`${parsed.data.prenoms} ${parsed.data.nom}`)}`,
  );
}

// =============================================================================
// Server Action : mise à jour d'un chauffeur existant
// =============================================================================
// L'id est passé via .bind() côté client, c'est plus propre que de le mettre
// en hidden input dans le form (qu'on pourrait tamper avec les DevTools).
// La RLS reste la barrière finale : si quelqu'un tente d'updater un id qui
// n'est pas dans son tenant, Postgres refusera.

export async function updateChauffeurAction(
  chauffeurId: string,
  _prev: ChauffeurFormState,
  formData: FormData,
): Promise<ChauffeurFormState> {
  const values = readFormValues(formData);

  // 1. Validation Zod identique à la création
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

  // 2. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", formError: "Session expirée. Reconnecte-toi.", values };
  }

  // 3. Update — RLS bloquera si le user n'a pas accès à ce chauffeur
  //    On NE met PAS à jour created_by (audit trail intact)
  const { error, data } = await supabase
    .from("chauffeurs")
    .update(parsed.data)
    .eq("id", chauffeurId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[updateChauffeurAction]", error);
    return mapDbErrorToFormState(error, values);
  }

  // Si maybeSingle renvoie null → RLS a filtré la ligne, donc pas le droit
  if (!data) {
    return {
      status: "error",
      formError: "Chauffeur introuvable ou tu n'as pas les droits pour le modifier.",
      values,
    };
  }

  // 4. Succès
  revalidatePath("/chauffeurs");
  revalidatePath(`/chauffeurs/${chauffeurId}`);
  revalidatePath("/dashboard");
  redirect(
    `/chauffeurs/${chauffeurId}?updated=${encodeURIComponent(`${parsed.data.prenoms} ${parsed.data.nom}`)}`,
  );
}

// =============================================================================
// Server Action : suppression d'un chauffeur
// =============================================================================
// Réservée par RLS aux MANAGER et SUPER_ADMIN. La défense en profondeur
// se fait via la policy DELETE on chauffeurs (voir migration #3).

export async function deleteChauffeurAction(chauffeurId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // On récupère d'abord le nom pour le flash post-suppression
  const { data: chauffeur } = await supabase
    .from("chauffeurs")
    .select("prenoms, nom")
    .eq("id", chauffeurId)
    .maybeSingle();

  const { error } = await supabase
    .from("chauffeurs")
    .delete()
    .eq("id", chauffeurId);

  if (error) {
    console.error("[deleteChauffeurAction]", error);
    // En cas d'erreur, on redirige avec un message d'erreur dans l'URL
    redirect(
      `/chauffeurs/${chauffeurId}?error=${encodeURIComponent(
        error.code === "42501" || error.message.includes("row-level security")
          ? "Tu n'as pas les droits pour supprimer ce chauffeur (MANAGER requis)."
          : `Erreur de suppression : ${error.message}`,
      )}`,
    );
  }

  revalidatePath("/chauffeurs");
  revalidatePath("/dashboard");

  const name = chauffeur ? `${chauffeur.prenoms} ${chauffeur.nom}` : "Chauffeur";
  redirect(`/chauffeurs?deleted=${encodeURIComponent(name)}`);
}
