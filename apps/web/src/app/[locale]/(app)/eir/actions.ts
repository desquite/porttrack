"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { JUSTIFICATIF_MIME, JUSTIFICATIF_MAX_SIZE } from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";

export type ConfirmDeliveryState =
  | { status: "idle" }
  | { status: "error"; formError: string };

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100);
}

// =============================================================================
// Confirmation de livraison avec EIR obligatoire (cahier §9.2)
// =============================================================================

export async function confirmDeliveryWithEirAction(
  _prev: ConfirmDeliveryState,
  formData: FormData,
): Promise<ConfirmDeliveryState> {
  const tenantId = String(formData.get("tenant_id") ?? "");
  const conteneurId = String(formData.get("conteneur_id") ?? "");
  const affectationId = String(formData.get("affectation_id") ?? "") || null;
  const mode = String(formData.get("mode_livraison") ?? "");
  const remorqueId = String(formData.get("remorque_id") ?? "") || null;
  const dateLivraisonRaw = String(formData.get("date_livraison") ?? "");
  const dateLivraison = /^\d{4}-\d{2}-\d{2}$/.test(dateLivraisonRaw)
    ? dateLivraisonRaw
    : new Date().toISOString().slice(0, 10);

  if (!tenantId || !conteneurId) {
    return { status: "error", formError: "Référence du conteneur manquante." };
  }
  if (!["REMORQUE_COUPEE", "CLIENT_DECHARGE", "AUTO_CHARGEUR"].includes(mode)) {
    return { status: "error", formError: "Choisis le mode de livraison." };
  }
  if (mode !== "AUTO_CHARGEUR" && !remorqueId) {
    return { status: "error", formError: "Indique la remorque utilisée." };
  }

  // EIR obligatoire (§9.2 : l'upload est exigé avant toute clôture)
  const file = formData.get("eir");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", formError: "L'EIR est obligatoire pour confirmer la livraison." };
  }
  const f = file as File;
  if (f.size > JUSTIFICATIF_MAX_SIZE) {
    return { status: "error", formError: "Fichier trop volumineux (10 Mo max)." };
  }
  if (!(JUSTIFICATIF_MIME as readonly string[]).includes(f.type)) {
    return { status: "error", formError: `Format non autorisé (${f.type}). PDF, JPG, PNG, HEIC acceptés.` };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", formError: "Session expirée." };

  // Snapshot chauffeur + camion depuis l'affectation (si fournie)
  let chauffeurId: string | null = null;
  let chauffeurNom: string | null = null;
  let tracteurId: string | null = null;
  let tracteurImmat: string | null = null;

  if (affectationId) {
    const { data: aff } = await supabase
      .from("affectations")
      .select(`
        chauffeur_id, tracteur_id,
        chauffeur:chauffeurs ( nom, prenoms ),
        tracteur:materiel_roulant ( immatriculation )
      `)
      .eq("id", affectationId)
      .maybeSingle();
    if (aff) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = aff as any;
      chauffeurId = a.chauffeur_id ?? null;
      tracteurId = a.tracteur_id ?? null;
      chauffeurNom = a.chauffeur ? `${a.chauffeur.nom} ${a.chauffeur.prenoms}`.trim() : null;
      tracteurImmat = a.tracteur?.immatriculation ?? null;
    }
  }

  // Snapshot remorque (sauf auto-chargeur) + lieu de livraison figé
  let remorqueImmat: string | null = null;
  if (remorqueId) {
    const { data: r } = await supabase.from("materiel_roulant").select("immatriculation, chrono").eq("id", remorqueId).maybeSingle();
    remorqueImmat = r ? (r.chrono ?? r.immatriculation) : null;
  }
  const { data: cont } = await supabase
    .from("conteneurs")
    .select("destination_libre, destination_id")
    .eq("id", conteneurId)
    .maybeSingle();
  let lieuLivraison: string | null = cont?.destination_libre ?? null;
  if (!lieuLivraison && cont?.destination_id) {
    const { data: p } = await supabase.from("port_codes").select("nom_lieu").eq("id", cont.destination_id).maybeSingle();
    lieuLivraison = p?.nom_lieu ?? null;
  }

  // 1) Upload de l'EIR
  const ext = f.name.split(".").pop()?.toLowerCase() ?? "bin";
  const base = sanitizeFilename(f.name.replace(/\.[^.]+$/, ""));
  const objectPath = `${tenantId}/eir/${conteneurId}/${randomUUID()}-${base}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("documents")
    .upload(objectPath, f, { cacheControl: "3600", contentType: f.type, upsert: false });
  if (upErr) {
    return { status: "error", formError: `Upload de l'EIR : ${upErr.message}` };
  }

  // 2) Insertion de l'archive EIR
  const { error: insErr } = await supabase.from("eir_archives").insert({
    tenant_id: tenantId,
    conteneur_id: conteneurId,
    affectation_id: affectationId,
    chauffeur_id: chauffeurId,
    chauffeur_nom: chauffeurNom,
    tracteur_id: tracteurId,
    tracteur_immat: tracteurImmat,
    remorque_id: remorqueId,
    remorque_immat: remorqueImmat,
    mode_livraison: mode as "REMORQUE_COUPEE" | "CLIENT_DECHARGE" | "AUTO_CHARGEUR",
    lieu_livraison: lieuLivraison,
    fichier_url: objectPath,
    fichier_nom: f.name,
    date_livraison: dateLivraison,
    uploaded_by: user.id,
    uploaded_by_email: user.email ?? null,
  });
  if (insErr) {
    await supabase.storage.from("documents").remove([objectPath]);
    return { status: "error", formError: `Archivage EIR : ${insErr.message}` };
  }

  // 3) Le conteneur passe en LIVRE + date de livraison réelle
  const { error: updErr } = await supabase
    .from("conteneurs")
    .update({ statut: "LIVRE", date_livraison_reelle: dateLivraison })
    .eq("id", conteneurId);
  if (updErr) {
    // L'EIR est archivé ; on signale juste que le statut n'a pas suivi.
    return { status: "error", formError: `EIR archivé mais statut non mis à jour : ${updErr.message}` };
  }

  revalidatePath(`/conteneurs/${conteneurId}`);
  revalidatePath("/conteneurs");
  revalidatePath("/eir");
  revalidatePath("/dashboard");
  redirect(`/conteneurs/${conteneurId}?livree=1`);
}

// =============================================================================
// Téléchargement d'un EIR archivé (URL signée)
// =============================================================================

export async function downloadEirAction(eirId: string): Promise<void> {
  const supabase = await createClient();
  const { data: e } = await supabase
    .from("eir_archives")
    .select("fichier_url, fichier_nom")
    .eq("id", eirId)
    .maybeSingle();
  if (!e?.fichier_url) redirect("/eir?error=EIR%20introuvable");

  const { data: signed, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(e!.fichier_url, 60, { download: e!.fichier_nom ?? undefined });
  if (error || !signed?.signedUrl) {
    redirect(`/eir?error=${encodeURIComponent(error?.message ?? "Lien indisponible")}`);
  }
  redirect(signed.signedUrl);
}
