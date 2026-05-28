"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  affectationCreateSchema,
  type AffectationCreateInput,
} from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";

export type AffectationFormState =
  | { status: "idle" }
  | {
      status: "error";
      formError?: string;
      fieldErrors?: Partial<Record<keyof AffectationCreateInput, string[]>>;
      values?: Partial<Record<string, string>>;
    };

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
): AffectationFormState {
  if (error.code === "42501" || error.message.includes("row-level security")) {
    return {
      status: "error",
      formError: "Tu n'as pas les droits suffisants pour cette opération.",
      values,
    };
  }
  // Le trigger de cohérence tenant lève une exception P0001
  if (error.message.includes("n'appartient pas à ce tenant")) {
    return {
      status: "error",
      formError: error.message,
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
  | { ok: true; data: ReturnType<typeof affectationCreateSchema.parse> }
  | { ok: false; state: AffectationFormState } {
  const parsed = affectationCreateSchema.safeParse(values);
  if (parsed.success) return { ok: true, data: parsed.data };

  const fieldErrors: Partial<Record<keyof AffectationCreateInput, string[]>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as keyof AffectationCreateInput | undefined;
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

export async function createAffectationAction(
  _prev: AffectationFormState,
  formData: FormData,
): Promise<AffectationFormState> {
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

  const { error } = await supabase.from("affectations").insert({
    ...parsed.data,
    created_by: user.id,
  });

  if (error) {
    console.error("[createAffectationAction]", error);
    return mapDbErrorToFormState(error, values);
  }

  revalidatePath("/affectations");
  revalidatePath("/dashboard");
  redirect(`/affectations?created=1`);
}

export async function updateAffectationAction(
  affectationId: string,
  _prev: AffectationFormState,
  formData: FormData,
): Promise<AffectationFormState> {
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
    .from("affectations")
    .update(parsed.data)
    .eq("id", affectationId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[updateAffectationAction]", error);
    return mapDbErrorToFormState(error, values);
  }
  if (!data) {
    return {
      status: "error",
      formError: "Affectation introuvable ou droits insuffisants.",
      values,
    };
  }

  revalidatePath("/affectations");
  revalidatePath(`/affectations/${affectationId}`);
  revalidatePath("/dashboard");
  redirect(`/affectations/${affectationId}?updated=1`);
}

export async function deleteAffectationAction(affectationId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("affectations")
    .delete()
    .eq("id", affectationId);

  if (error) {
    console.error("[deleteAffectationAction]", error);
    redirect(
      `/affectations/${affectationId}?error=${encodeURIComponent(
        error.code === "42501" || error.message.includes("row-level security")
          ? "Suppression réservée aux MANAGER."
          : `Erreur de suppression : ${error.message}`,
      )}`,
    );
  }

  revalidatePath("/affectations");
  revalidatePath("/dashboard");
  redirect(`/affectations?deleted=1`);
}
