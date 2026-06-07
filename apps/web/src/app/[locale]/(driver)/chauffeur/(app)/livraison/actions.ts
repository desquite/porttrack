"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ConfirmDeliveryState =
  | { status: "idle" }
  | { status: "error"; formError: string };

const MAX_FILE = 10 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
const MODES = ["REMORQUE_COUPEE", "CLIENT_DECHARGE", "AUTO_CHARGEUR"];

/**
 * Confirmation de livraison PAR LE CHAUFFEUR (PWA, cahier §9.2 + remorque).
 * EIR obligatoire. Capture le mode de livraison + la remorque utilisée (sauf
 * auto-chargeur) + le lieu figé. Inserts/maj via client admin après validation
 * d'appartenance (RLS Storage + update conteneur bloqués pour le chauffeur).
 */
export async function confirmDriverDelivery(
  _prev: ConfirmDeliveryState,
  formData: FormData,
): Promise<ConfirmDeliveryState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", formError: "Session expirée." };

  const { data: chauffeur } = await supabase
    .from("chauffeurs")
    .select("id, prenoms, nom, tenant_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!chauffeur) return { status: "error", formError: "Compte chauffeur introuvable." };

  const conteneurId = String(formData.get("conteneur_id") ?? "");
  const mode = String(formData.get("mode_livraison") ?? "");
  const remorqueId = String(formData.get("remorque_id") ?? "") || null;
  if (!conteneurId) return { status: "error", formError: "Conteneur manquant." };
  if (!MODES.includes(mode)) return { status: "error", formError: "Choisis le mode de livraison." };
  if (mode !== "AUTO_CHARGEUR" && !remorqueId) {
    return { status: "error", formError: "Indique la remorque utilisée." };
  }

  // EIR obligatoire
  const file = formData.get("eir");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", formError: "La photo de l'EIR est obligatoire." };
  }
  const f = file as File;
  if (f.size > MAX_FILE) return { status: "error", formError: "Fichier trop volumineux (10 Mo max)." };
  if (!ALLOWED_MIME.includes(f.type)) return { status: "error", formError: `Format non autorisé (${f.type}).` };

  // Le conteneur doit lui être affecté
  const { data: aff } = await supabase
    .from("affectations")
    .select("id, tracteur_id")
    .eq("conteneur_id", conteneurId)
    .eq("chauffeur_id", chauffeur.id)
    .maybeSingle();
  if (!aff) return { status: "error", formError: "Ce conteneur ne t'est pas affecté." };

  const { data: cont } = await supabase
    .from("conteneurs")
    .select("id, statut, destination_libre, destination_id")
    .eq("id", conteneurId)
    .maybeSingle();
  if (!cont) return { status: "error", formError: "Conteneur introuvable." };
  if (cont.statut === "LIVRE") return { status: "error", formError: "Ce conteneur est déjà livré." };

  // Snapshots camion + remorque
  let tracteurImmat: string | null = null;
  if (aff.tracteur_id) {
    const { data: t } = await supabase.from("materiel_roulant").select("immatriculation, chrono").eq("id", aff.tracteur_id).maybeSingle();
    tracteurImmat = t ? (t.chrono ?? t.immatriculation) : null;
  }
  let remorqueImmat: string | null = null;
  if (remorqueId) {
    const { data: r } = await supabase.from("materiel_roulant").select("immatriculation, chrono").eq("id", remorqueId).maybeSingle();
    remorqueImmat = r ? (r.chrono ?? r.immatriculation) : null;
  }
  // Lieu figé (destination)
  let lieu: string | null = cont.destination_libre ?? null;
  if (!lieu && cont.destination_id) {
    const { data: p } = await supabase.from("port_codes").select("nom_lieu").eq("id", cont.destination_id).maybeSingle();
    lieu = p?.nom_lieu ?? null;
  }

  const today = new Date().toISOString().slice(0, 10);
  const admin = createAdminClient();

  // 1) Upload EIR
  const ext = f.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${chauffeur.tenant_id}/eir/${conteneurId}/${randomUUID()}.${ext}`;
  const { error: upErr } = await admin.storage.from("documents").upload(path, f, { contentType: f.type, upsert: false });
  if (upErr) return { status: "error", formError: `Upload de l'EIR : ${upErr.message}` };

  // 2) Archive EIR
  const { error: insErr } = await admin.from("eir_archives").insert({
    tenant_id: chauffeur.tenant_id,
    conteneur_id: conteneurId,
    affectation_id: aff.id,
    chauffeur_id: chauffeur.id,
    chauffeur_nom: `${chauffeur.prenoms} ${chauffeur.nom}`.trim(),
    tracteur_id: aff.tracteur_id,
    tracteur_immat: tracteurImmat,
    remorque_id: remorqueId,
    remorque_immat: remorqueImmat,
    mode_livraison: mode as "REMORQUE_COUPEE" | "CLIENT_DECHARGE" | "AUTO_CHARGEUR",
    lieu_livraison: lieu,
    fichier_url: path,
    fichier_nom: f.name,
    date_livraison: today,
    uploaded_by: null,
    uploaded_by_email: null,
  });
  if (insErr) {
    await admin.storage.from("documents").remove([path]);
    return { status: "error", formError: `Archivage : ${insErr.message}` };
  }

  // 3) Conteneur → LIVRE
  const { error: contErr } = await admin
    .from("conteneurs")
    .update({ statut: "LIVRE", date_livraison_reelle: today })
    .eq("id", conteneurId);
  // EIR déjà archivé : on log mais on ne bloque pas (la livraison est faite).
  if (contErr) console.error("[confirmDriverDelivery] maj conteneur LIVRE:", contErr);

  // 4) Affectation → TERMINEE (sinon le conteneur reste dans « à livrer » côté
  //    chauffeur — filtré sur le statut affectation — et dans « affectations
  //    actives » côté bureau).
  const { error: affErr } = await admin
    .from("affectations")
    .update({ statut: "TERMINEE", date_retour: new Date().toISOString() })
    .eq("id", aff.id);
  if (affErr) console.error("[confirmDriverDelivery] maj affectation TERMINEE:", affErr);

  revalidatePath("/chauffeur");
  revalidatePath("/chauffeur/mouvements");
  redirect("/chauffeur?livraison=ok");
}
