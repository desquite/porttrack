"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { absenceCreateSchema, type AbsenceCreateInput } from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";

export type AbsenceFormState =
  | { status: "idle" }
  | {
      status: "error";
      formError?: string;
      fieldErrors?: Partial<Record<keyof AbsenceCreateInput, string[]>>;
      values?: Partial<Record<string, string>>;
    };

function readFormValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function parseFormData(values: Record<string, string>) {
  const parsed = absenceCreateSchema.safeParse(values);
  if (parsed.success) return { ok: true as const, data: parsed.data };
  const fieldErrors: Partial<Record<keyof AbsenceCreateInput, string[]>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as keyof AbsenceCreateInput | undefined;
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

function mapDbErr(error: { code?: string; message: string }, values: Record<string, string>): AbsenceFormState {
  if (error.code === "42501" || error.message.includes("row-level security")) {
    return { status: "error", formError: "Tu n'as pas les droits pour cette opération.", values };
  }
  return { status: "error", formError: `Erreur base : ${error.message}`, values };
}

export async function createAbsenceAction(
  _prev: AbsenceFormState,
  formData: FormData,
): Promise<AbsenceFormState> {
  const values = readFormValues(formData);
  const parsed = parseFormData(values);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", formError: "Session expirée.", values };

  const d = parsed.data;
  const { data: created, error } = await supabase
    .from("absences")
    .insert({
      tenant_id: d.tenant_id,
      chauffeur_id: d.chauffeur_id,
      type: d.type,
      date_debut: d.date_debut,
      date_fin: d.date_fin,
      motif: d.motif,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !created) return mapDbErr(error ?? { message: "inconnue" }, values);

  revalidatePath("/absences");
  revalidatePath("/planning");
  revalidatePath("/chauffeurs");
  redirect(`/absences/${created.id}?created=1`);
}

export async function updateAbsenceAction(
  absenceId: string,
  _prev: AbsenceFormState,
  formData: FormData,
): Promise<AbsenceFormState> {
  const values = readFormValues(formData);
  const parsed = parseFormData(values);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", formError: "Session expirée.", values };

  const d = parsed.data;
  const { data: updated, error } = await supabase
    .from("absences")
    .update({
      chauffeur_id: d.chauffeur_id,
      type: d.type,
      date_debut: d.date_debut,
      date_fin: d.date_fin,
      motif: d.motif,
    })
    .eq("id", absenceId)
    .select("id")
    .maybeSingle();

  if (error) return mapDbErr(error, values);
  if (!updated) return { status: "error", formError: "Absence introuvable ou droits insuffisants.", values };

  revalidatePath("/absences");
  revalidatePath(`/absences/${absenceId}`);
  revalidatePath("/planning");
  redirect(`/absences/${absenceId}?updated=1`);
}

export async function deleteAbsenceAction(absenceId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("absences").delete().eq("id", absenceId);
  if (error) {
    redirect(`/absences/${absenceId}?error=${encodeURIComponent(`Erreur : ${error.message}`)}`);
  }
  revalidatePath("/absences");
  revalidatePath("/planning");
  redirect("/absences?deleted=1");
}
