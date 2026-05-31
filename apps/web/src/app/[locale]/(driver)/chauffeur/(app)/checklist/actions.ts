"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { CHECKLIST_ITEM_ETATS } from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type DriverChecklistState =
  | { status: "idle" }
  | { status: "error"; formError: string };

const ITEM_RE = /^item-([0-9a-f-]{36})$/i;
const MAX_FILE = 10 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic"];

/**
 * Soumission de la check-list de départ PAR LE CHAUFFEUR (PWA, cahier §7.3).
 * Les inserts DB passent par la session du chauffeur (RLS « own »). La photo
 * passe par le client admin car la RLS Storage bloque le chauffeur (pas de
 * tenant dans son JWT) — on valide l'appartenance avant.
 */
export async function submitDriverChecklist(
  _prev: DriverChecklistState,
  formData: FormData,
): Promise<DriverChecklistState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", formError: "Session expirée." };

  const { data: chauffeur } = await supabase
    .from("chauffeurs")
    .select("id, tenant_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!chauffeur) return { status: "error", formError: "Compte chauffeur introuvable." };

  const designationId = String(formData.get("designation_id") ?? "");
  if (!designationId) return { status: "error", formError: "Désignation manquante." };

  // La désignation doit être la sienne
  const { data: des } = await supabase
    .from("designations")
    .select("id, chauffeur_id, materiel_roulant_id, date_designation")
    .eq("id", designationId)
    .maybeSingle();
  if (!des || des.chauffeur_id !== chauffeur.id) {
    return { status: "error", formError: "Désignation invalide." };
  }

  // Réponses items
  const responses: Array<{ itemId: string; etat: "OK" | "ANOMALIE" }> = [];
  for (const [k, v] of formData.entries()) {
    const m = String(k).match(ITEM_RE);
    if (!m || typeof v !== "string" || v === "") continue;
    if (!(CHECKLIST_ITEM_ETATS as readonly string[]).includes(v)) {
      return { status: "error", formError: "Réponse invalide." };
    }
    responses.push({ itemId: m[1], etat: v as "OK" | "ANOMALIE" });
  }
  if (responses.length === 0) return { status: "error", formError: "Réponds à tous les items." };

  const remarqueRaw = String(formData.get("remarque") ?? "").trim();
  const remarque = remarqueRaw || null;

  // 1) Check-list
  const { data: created, error } = await supabase
    .from("checklists_depart")
    .insert({
      tenant_id: chauffeur.tenant_id,
      designation_id: des.id,
      chauffeur_id: chauffeur.id,
      materiel_roulant_id: des.materiel_roulant_id,
      date_depart: des.date_designation,
      remarque,
      created_by: null,
    })
    .select("id")
    .single();
  if (error || !created) {
    if (error?.code === "23505") return { status: "error", formError: "Check-list déjà faite pour aujourd'hui." };
    return { status: "error", formError: `Erreur : ${error?.message ?? "inconnue"}` };
  }

  // 2) Réponses (le trigger recalcule statut_global)
  const rows = responses.map((r) => ({
    tenant_id: chauffeur.tenant_id,
    checklist_id: created.id,
    item_config_id: r.itemId,
    etat: r.etat,
  }));
  const { error: rerr } = await supabase.from("checklist_responses").insert(rows);
  if (rerr) {
    await supabase.from("checklists_depart").delete().eq("id", created.id);
    return { status: "error", formError: `Erreur : ${rerr.message}` };
  }

  // 3) Photo optionnelle (via admin — RLS Storage bloque le chauffeur)
  const file = formData.get("photo");
  if (file instanceof File && file.size > 0 && file.size <= MAX_FILE && ALLOWED_MIME.includes(file.type)) {
    const admin = createAdminClient();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${chauffeur.tenant_id}/checklists/${created.id}/photo-${randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from("documents")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (!upErr) {
      await admin.from("checklist_photos").insert({
        checklist_id: created.id,
        tenant_id: chauffeur.tenant_id,
        photo_url: path,
        photo_nom: file.name,
        uploaded_by: null,
      });
    }
  }

  revalidatePath("/chauffeur");
  redirect("/chauffeur?checklist=ok");
}
