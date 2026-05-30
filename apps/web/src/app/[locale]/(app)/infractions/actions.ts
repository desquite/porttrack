"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import {
  INFRACTION_STATUTS,
  infractionCreateSchema,
  type InfractionCreateInput,
  type InfractionStatut,
} from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";

export type InfractionFormState =
  | { status: "idle" }
  | {
      status: "error";
      formError?: string;
      fieldErrors?: Partial<Record<keyof InfractionCreateInput, string[]>>;
      values?: Partial<Record<string, string>>;
    };

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"] as const;

function readFormValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function parseFormData(values: Record<string, string>) {
  const parsed = infractionCreateSchema.safeParse(values);
  if (parsed.success) return { ok: true as const, data: parsed.data };
  const fieldErrors: Partial<Record<keyof InfractionCreateInput, string[]>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as keyof InfractionCreateInput | undefined;
    if (!field) continue;
    (fieldErrors[field] ??= []).push(issue.message);
  }
  return {
    ok: false as const,
    state: { status: "error" as const, formError: "Corrige les champs en rouge.", fieldErrors, values },
  };
}

function sanitizeFilename(name: string): string {
  return name.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}

function mapDbErr(error: { code?: string; message: string }, values: Record<string, string>): InfractionFormState {
  if (error.code === "42501" || error.message.includes("row-level security")) {
    return { status: "error", formError: "Tu n'as pas les droits pour cette opération.", values };
  }
  return { status: "error", formError: `Erreur base : ${error.message}`, values };
}

// =============================================================================
// Création / Mise à jour
// =============================================================================

export async function createInfractionAction(
  _prev: InfractionFormState,
  formData: FormData,
): Promise<InfractionFormState> {
  const values = readFormValues(formData);
  const parsed = parseFormData(values);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", formError: "Session expirée.", values };

  const d = parsed.data;
  const { data: created, error } = await supabase
    .from("infractions")
    .insert({
      tenant_id: d.tenant_id,
      chauffeur_id: d.chauffeur_id,
      materiel_roulant_id: d.materiel_roulant_id,
      date_infraction: d.date_infraction,
      lieu_infraction: d.lieu_infraction,
      type_infraction: d.type_infraction,
      description: d.description,
      montant_fcfa: d.montant_fcfa,
      date_limite_paiement: d.date_limite_paiement,
      date_paiement: d.date_paiement,
      statut: d.statut,
      imputation: d.imputation,
      notes: d.notes,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !created) return mapDbErr(error ?? { message: "inconnue" }, values);

  revalidatePath("/infractions");
  revalidatePath("/dashboard");
  redirect(`/infractions/${created.id}?created=1`);
}

export async function updateInfractionAction(
  infractionId: string,
  _prev: InfractionFormState,
  formData: FormData,
): Promise<InfractionFormState> {
  const values = readFormValues(formData);
  const parsed = parseFormData(values);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", formError: "Session expirée.", values };

  const d = parsed.data;
  const { data: updated, error } = await supabase
    .from("infractions")
    .update({
      chauffeur_id: d.chauffeur_id,
      materiel_roulant_id: d.materiel_roulant_id,
      date_infraction: d.date_infraction,
      lieu_infraction: d.lieu_infraction,
      type_infraction: d.type_infraction,
      description: d.description,
      montant_fcfa: d.montant_fcfa,
      date_limite_paiement: d.date_limite_paiement,
      date_paiement: d.date_paiement,
      statut: d.statut,
      imputation: d.imputation,
      notes: d.notes,
    })
    .eq("id", infractionId)
    .select("id")
    .maybeSingle();

  if (error) return mapDbErr(error, values);
  if (!updated) return { status: "error", formError: "Infraction introuvable ou droits insuffisants.", values };

  revalidatePath("/infractions");
  revalidatePath(`/infractions/${infractionId}`);
  revalidatePath("/dashboard");
  redirect(`/infractions/${infractionId}?updated=1`);
}

// =============================================================================
// Transition rapide statut (Non payée → Payée / Contestée)
// =============================================================================

export async function changeInfractionStatutAction(
  infractionId: string,
  newStatut: InfractionStatut,
): Promise<void> {
  if (!(INFRACTION_STATUTS as readonly string[]).includes(newStatut)) {
    redirect(`/infractions/${infractionId}?error=${encodeURIComponent("Statut invalide")}`);
  }
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { error, data } = await supabase
    .from("infractions")
    .update({
      statut: newStatut,
      ...(newStatut === "PAYEE" ? { date_paiement: today } : {}),
    })
    .eq("id", infractionId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirect(`/infractions/${infractionId}?error=${encodeURIComponent(error?.message ?? "Mise à jour impossible")}`);
  }
  revalidatePath("/infractions");
  revalidatePath(`/infractions/${infractionId}`);
  redirect(`/infractions/${infractionId}?updated=1`);
}

// =============================================================================
// Upload / download PV & reçu
// =============================================================================

async function uploadInfractionDoc(
  infractionId: string,
  tenantId: string,
  formData: FormData,
  field: "pv" | "recu",
): Promise<void> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/infractions/${infractionId}?error=${encodeURIComponent("Aucun fichier")}`);
  }
  const f = file as File;
  if (f.size > MAX_FILE_SIZE) {
    redirect(`/infractions/${infractionId}?error=${encodeURIComponent(`Fichier trop volumineux (${(f.size / 1024 / 1024).toFixed(1)} Mo)`)}`);
  }
  if (!(ALLOWED_MIME as readonly string[]).includes(f.type)) {
    redirect(`/infractions/${infractionId}?error=${encodeURIComponent(`Type non autorisé (${f.type})`)}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ext = f.name.split(".").pop()?.toLowerCase() ?? "bin";
  const base = sanitizeFilename(f.name.replace(/\.[^.]+$/, ""));
  const objectPath = `${tenantId}/infractions/${infractionId}/${field}-${randomUUID()}-${base}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("documents")
    .upload(objectPath, f, { cacheControl: "3600", contentType: f.type, upsert: false });
  if (upErr) redirect(`/infractions/${infractionId}?error=${encodeURIComponent(`Upload : ${upErr.message}`)}`);

  const { data: prev } = await supabase
    .from("infractions")
    .select("pv_url, recu_url")
    .eq("id", infractionId)
    .maybeSingle();
  const prevPath = field === "pv" ? prev?.pv_url : prev?.recu_url;

  const patch = field === "pv"
    ? { pv_url: objectPath, pv_nom: f.name }
    : { recu_url: objectPath, recu_nom: f.name };
  const { error: dbErr } = await supabase
    .from("infractions")
    .update(patch)
    .eq("id", infractionId);
  if (dbErr) {
    await supabase.storage.from("documents").remove([objectPath]);
    redirect(`/infractions/${infractionId}?error=${encodeURIComponent(`Erreur : ${dbErr.message}`)}`);
  }
  if (prevPath && prevPath !== objectPath) {
    await supabase.storage.from("documents").remove([prevPath]);
  }
  revalidatePath(`/infractions/${infractionId}`);
  redirect(`/infractions/${infractionId}?uploaded=${field}`);
}

export const uploadPvAction = (id: string, tenantId: string, fd: FormData) =>
  uploadInfractionDoc(id, tenantId, fd, "pv");
export const uploadRecuAction = (id: string, tenantId: string, fd: FormData) =>
  uploadInfractionDoc(id, tenantId, fd, "recu");

async function downloadInfractionDoc(infractionId: string, field: "pv" | "recu"): Promise<void> {
  const supabase = await createClient();
  const { data: i } = await supabase
    .from("infractions")
    .select("pv_url, pv_nom, recu_url, recu_nom")
    .eq("id", infractionId)
    .maybeSingle();
  const path = field === "pv" ? i?.pv_url : i?.recu_url;
  const nom  = field === "pv" ? i?.pv_nom : i?.recu_nom;
  if (!path) redirect(`/infractions/${infractionId}?error=${encodeURIComponent("Aucun fichier")}`);

  const { data: signed, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(path!, 60, { download: nom ?? undefined });
  if (error || !signed?.signedUrl) {
    redirect(`/infractions/${infractionId}?error=${encodeURIComponent(error?.message ?? "Lien indisponible")}`);
  }
  redirect(signed.signedUrl);
}

export const downloadPvAction = (id: string) => downloadInfractionDoc(id, "pv");
export const downloadRecuAction = (id: string) => downloadInfractionDoc(id, "recu");

// =============================================================================
// Suppression
// =============================================================================

export async function deleteInfractionAction(infractionId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: i } = await supabase
    .from("infractions")
    .select("pv_url, recu_url")
    .eq("id", infractionId)
    .maybeSingle();

  const { error } = await supabase.from("infractions").delete().eq("id", infractionId);
  if (error) {
    redirect(`/infractions/${infractionId}?error=${encodeURIComponent(
      error.code === "42501" || error.message.includes("row-level security")
        ? "Suppression réservée aux MANAGER."
        : `Erreur : ${error.message}`,
    )}`);
  }
  const toRemove = [i?.pv_url, i?.recu_url].filter((p): p is string => !!p);
  if (toRemove.length > 0) await supabase.storage.from("documents").remove(toRemove);

  revalidatePath("/infractions");
  revalidatePath("/dashboard");
  redirect("/infractions?deleted=1");
}
