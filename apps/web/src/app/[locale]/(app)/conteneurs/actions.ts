"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  conteneurCreateSchema,
  type ConteneurCreateInput,
} from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";

// =============================================================================
// État partagé avec le formulaire (useActionState)
// =============================================================================

export type ConteneurFormState =
  | { status: "idle" }
  | {
      status: "error";
      formError?: string;
      fieldErrors?: Partial<Record<keyof ConteneurCreateInput, string[]>>;
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
): ConteneurFormState {
  if (error.code === "23505" && error.message.includes("numero")) {
    return {
      status: "error",
      fieldErrors: {
        numero: ["Un conteneur avec ce numéro existe déjà dans cette entreprise"],
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
):
  | { ok: true; data: ReturnType<typeof conteneurCreateSchema.parse> }
  | { ok: false; state: ConteneurFormState } {
  const parsed = conteneurCreateSchema.safeParse(values);
  if (parsed.success) return { ok: true, data: parsed.data };

  const fieldErrors: Partial<Record<keyof ConteneurCreateInput, string[]>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as keyof ConteneurCreateInput | undefined;
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
// Création
// =============================================================================

export async function createConteneurAction(
  _prev: ConteneurFormState,
  formData: FormData,
): Promise<ConteneurFormState> {
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

  const { error } = await supabase.from("conteneurs").insert({
    ...parsed.data,
    created_by: user.id,
  });

  if (error) {
    console.error("[createConteneurAction]", error);
    return mapDbErrorToFormState(error, values);
  }

  revalidatePath("/conteneurs");
  revalidatePath("/dashboard");
  redirect(`/conteneurs?created=${encodeURIComponent(parsed.data.numero)}`);
}

// =============================================================================
// Mise à jour
// =============================================================================

export async function updateConteneurAction(
  conteneurId: string,
  _prev: ConteneurFormState,
  formData: FormData,
): Promise<ConteneurFormState> {
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
    .from("conteneurs")
    .update(parsed.data)
    .eq("id", conteneurId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[updateConteneurAction]", error);
    return mapDbErrorToFormState(error, values);
  }
  if (!data) {
    return {
      status: "error",
      formError: "Conteneur introuvable ou tu n'as pas les droits pour le modifier.",
      values,
    };
  }

  revalidatePath("/conteneurs");
  revalidatePath(`/conteneurs/${conteneurId}`);
  revalidatePath("/dashboard");
  redirect(`/conteneurs/${conteneurId}?updated=${encodeURIComponent(parsed.data.numero)}`);
}

// =============================================================================
// Suppression
// =============================================================================

export async function deleteConteneurAction(conteneurId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: conteneur } = await supabase
    .from("conteneurs")
    .select("numero")
    .eq("id", conteneurId)
    .maybeSingle();

  const { error } = await supabase
    .from("conteneurs")
    .delete()
    .eq("id", conteneurId);

  if (error) {
    console.error("[deleteConteneurAction]", error);
    redirect(
      `/conteneurs/${conteneurId}?error=${encodeURIComponent(
        error.code === "42501" || error.message.includes("row-level security")
          ? "Suppression réservée aux MANAGER."
          : `Erreur de suppression : ${error.message}`,
      )}`,
    );
  }

  revalidatePath("/conteneurs");
  revalidatePath("/dashboard");
  redirect(`/conteneurs?deleted=${encodeURIComponent(conteneur?.numero ?? "Conteneur")}`);
}
