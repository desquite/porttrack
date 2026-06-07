"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FILE = 5 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
const MODES = ["REMORQUE_COUPEE", "CLIENT_DECHARGE", "AUTO_CHARGEUR"];

export type SaisieFormState =
  | { status: "idle" }
  | { status: "error"; formError: string; values?: Record<string, string> };

function readValues(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

async function getCurrentOperateur() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase
    .from("users")
    .select("id, tenant_id, prenoms, nom, email")
    .eq("id", user.id)
    .maybeSingle();
  if (!me) return null;
  const fullName = `${me.prenoms ?? ""} ${me.nom ?? ""}`.trim();
  const nom = fullName || me.email || "Opérateur";
  return { id: me.id, tenant_id: me.tenant_id, nom };
}

// =============================================================================
// LIVRAISON — Saisie bureau à partir de l'EIR papier
// =============================================================================
// Reproduit le flux PWA chauffeur (apps/web/.../driver/livraison/actions.ts) :
// upload EIR → eir_archives → conteneur LIVRE → affectation TERMINEE.
// La distinction PWA / Bureau est portée par validated_via.
// =============================================================================

export async function validerLivraisonAction(
  affectationId: string,
  _prev: SaisieFormState,
  formData: FormData,
): Promise<SaisieFormState> {
  const values = readValues(formData);
  const operateur = await getCurrentOperateur();
  if (!operateur) return { status: "error", formError: "Session expirée." };
  if (!operateur.tenant_id) return { status: "error", formError: "Aucune entreprise rattachée." };

  const chauffeurId = values.chauffeur_id?.trim();
  const tracteurId = values.tracteur_id?.trim();
  const remorqueId = values.remorque_id?.trim() || null;
  const mode = values.mode_livraison?.trim();
  const dateLivraison = values.date_livraison?.trim() || new Date().toISOString().slice(0, 10);

  if (!chauffeurId) return { status: "error", formError: "Choisis un chauffeur.", values };
  if (!tracteurId) return { status: "error", formError: "Choisis un tracteur.", values };
  if (!mode || !MODES.includes(mode)) {
    return { status: "error", formError: "Choisis le mode de livraison.", values };
  }
  if (mode !== "AUTO_CHARGEUR" && !remorqueId) {
    return { status: "error", formError: "Indique la remorque utilisée.", values };
  }

  const file = formData.get("eir");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", formError: "Le fichier EIR (PDF ou image) est obligatoire.", values };
  }
  if (file.size > MAX_FILE) {
    return { status: "error", formError: "Fichier trop volumineux (5 Mo max).", values };
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return { status: "error", formError: `Format non autorisé (${file.type}).`, values };
  }

  const supabase = await createClient();

  // Affectation cible — doit appartenir au tenant et être active
  const { data: aff } = await supabase
    .from("affectations")
    .select("id, conteneur_id, chauffeur_id, tracteur_id, statut, tenant_id")
    .eq("id", affectationId)
    .maybeSingle();
  if (!aff) return { status: "error", formError: "Affectation introuvable.", values };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const affAny = aff as any;
  if (affAny.tenant_id && affAny.tenant_id !== operateur.tenant_id) {
    return { status: "error", formError: "Affectation hors de votre entreprise.", values };
  }
  if (!["PLANIFIEE", "EN_COURS"].includes(aff.statut)) {
    return { status: "error", formError: "Cette affectation n'est plus active.", values };
  }

  const { data: cont } = await supabase
    .from("conteneurs")
    .select("id, statut, destination_libre, destination_id")
    .eq("id", aff.conteneur_id)
    .maybeSingle();
  if (!cont) return { status: "error", formError: "Conteneur introuvable.", values };
  if (cont.statut === "LIVRE") {
    return { status: "error", formError: "Ce conteneur est déjà livré.", values };
  }

  // Snapshots noms/immat
  const [{ data: ch }, { data: tr }, { data: rm }] = await Promise.all([
    supabase.from("chauffeurs").select("prenoms, nom").eq("id", chauffeurId).maybeSingle(),
    supabase.from("materiel_roulant").select("immatriculation, chrono").eq("id", tracteurId).maybeSingle(),
    remorqueId
      ? supabase.from("materiel_roulant").select("immatriculation, chrono").eq("id", remorqueId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const chauffeurNom = ch ? `${ch.prenoms} ${ch.nom}`.trim() : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tracteurImmat = tr ? ((tr as any).chrono ?? tr.immatriculation) : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const remorqueImmat = rm ? ((rm as any).chrono ?? rm.immatriculation) : null;

  // Lieu figé (destination)
  let lieu: string | null = cont.destination_libre ?? null;
  if (!lieu && cont.destination_id) {
    const { data: p } = await supabase.from("port_codes").select("nom_lieu").eq("id", cont.destination_id).maybeSingle();
    lieu = p?.nom_lieu ?? null;
  }

  // Upload fichier EIR (bucket `documents`, chemin identique à la PWA)
  const admin = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
  const path = `${operateur.tenant_id}/eir/${cont.id}/${randomUUID()}.${ext}`;
  const { error: upErr } = await admin.storage
    .from("documents")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { status: "error", formError: `Upload de l'EIR : ${upErr.message}`, values };

  // Insert eir_archives (avec traçabilité saisie bureau)
  const { error: insErr } = await admin.from("eir_archives").insert({
    tenant_id: operateur.tenant_id,
    conteneur_id: cont.id,
    affectation_id: aff.id,
    chauffeur_id: chauffeurId,
    chauffeur_nom: chauffeurNom,
    tracteur_id: tracteurId,
    tracteur_immat: tracteurImmat,
    remorque_id: remorqueId,
    remorque_immat: remorqueImmat,
    mode_livraison: mode as "REMORQUE_COUPEE" | "CLIENT_DECHARGE" | "AUTO_CHARGEUR",
    lieu_livraison: lieu,
    fichier_url: path,
    fichier_nom: file.name,
    date_livraison: dateLivraison,
    uploaded_by: operateur.id,
    uploaded_by_email: null,
    // Traçabilité saisie bureau
    validated_via: "SAISIE_BUREAU",
    validated_by_user_id: operateur.id,
    validated_by_nom: operateur.nom,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  if (insErr) {
    await admin.storage.from("documents").remove([path]);
    return { status: "error", formError: `Archivage : ${insErr.message}`, values };
  }

  // Conteneur → LIVRE
  const { error: contErr } = await admin
    .from("conteneurs")
    .update({ statut: "LIVRE", date_livraison_reelle: dateLivraison })
    .eq("id", cont.id);
  if (contErr) console.error("[validerLivraison] maj conteneur LIVRE:", contErr);

  // Affectation → TERMINEE
  const { error: affErr } = await admin
    .from("affectations")
    .update({ statut: "TERMINEE", date_retour: new Date().toISOString() })
    .eq("id", aff.id);
  if (affErr) console.error("[validerLivraison] maj affectation TERMINEE:", affErr);

  revalidatePath("/saisie-operation");
  revalidatePath("/livraisons");
  revalidatePath("/conteneurs");
  redirect("/saisie-operation?onglet=livraisons&saisi=1");
}

// =============================================================================
// RÉCUPÉRATION — Saisie bureau à partir de l'EIR papier
// =============================================================================
// Met à jour la ligne `recuperations` (PLANIFIEE → CONFIRMEE) + archive l'EIR.
// =============================================================================

export async function validerRecuperationAction(
  recuperationId: string,
  _prev: SaisieFormState,
  formData: FormData,
): Promise<SaisieFormState> {
  const values = readValues(formData);
  const operateur = await getCurrentOperateur();
  if (!operateur) return { status: "error", formError: "Session expirée." };
  if (!operateur.tenant_id) return { status: "error", formError: "Aucune entreprise rattachée." };

  const chauffeurId = values.chauffeur_id?.trim();
  const tracteurId = values.tracteur_id?.trim();
  const remorqueId = values.remorque_id?.trim() || null;
  const dateRecuperation = values.date_recuperation?.trim() || new Date().toISOString().slice(0, 10);

  if (!chauffeurId) return { status: "error", formError: "Choisis un chauffeur.", values };
  if (!tracteurId) return { status: "error", formError: "Choisis un tracteur.", values };

  const file = formData.get("eir");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", formError: "Le fichier EIR (PDF ou image) est obligatoire.", values };
  }
  if (file.size > MAX_FILE) {
    return { status: "error", formError: "Fichier trop volumineux (5 Mo max).", values };
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return { status: "error", formError: `Format non autorisé (${file.type}).`, values };
  }

  const supabase = await createClient();

  const { data: recup } = await supabase
    .from("recuperations")
    .select("id, conteneur_id, statut, tenant_id")
    .eq("id", recuperationId)
    .maybeSingle();
  if (!recup) return { status: "error", formError: "Récupération introuvable.", values };
  if (recup.tenant_id !== operateur.tenant_id) {
    return { status: "error", formError: "Récupération hors de votre entreprise.", values };
  }
  if (recup.statut !== "PLANIFIEE") {
    return { status: "error", formError: "Cette récupération n'est plus à valider.", values };
  }

  // Snapshots
  const [{ data: ch }, { data: tr }, { data: rm }] = await Promise.all([
    supabase.from("chauffeurs").select("prenoms, nom").eq("id", chauffeurId).maybeSingle(),
    supabase.from("materiel_roulant").select("immatriculation, chrono").eq("id", tracteurId).maybeSingle(),
    remorqueId
      ? supabase.from("materiel_roulant").select("immatriculation, chrono").eq("id", remorqueId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const chauffeurNom = ch ? `${ch.prenoms} ${ch.nom}`.trim() : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tracteurImmat = tr ? ((tr as any).chrono ?? tr.immatriculation) : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const remorqueImmat = rm ? ((rm as any).chrono ?? rm.immatriculation) : null;

  // Upload EIR
  const admin = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
  const path = `${operateur.tenant_id}/eir/${recup.conteneur_id}/${randomUUID()}.${ext}`;
  const { error: upErr } = await admin.storage
    .from("documents")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { status: "error", formError: `Upload de l'EIR : ${upErr.message}`, values };

  // Update recuperations : CONFIRMEE + champs réels + traçabilité
  const { error: updErr } = await admin
    .from("recuperations")
    .update({
      statut: "CONFIRMEE",
      chauffeur_id: chauffeurId,
      tracteur_id: tracteurId,
      remorque_id: remorqueId,
      chauffeur_nom: chauffeurNom,
      tracteur_immat: tracteurImmat,
      remorque_immat: remorqueImmat,
      date_recuperation: dateRecuperation,
      eir_url: path,
      eir_nom: file.name,
      confirmed_by: operateur.id,
      // Traçabilité saisie bureau
      validated_via: "SAISIE_BUREAU",
      validated_by_nom: operateur.nom,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .eq("id", recup.id);
  if (updErr) {
    await admin.storage.from("documents").remove([path]);
    return { status: "error", formError: `Validation : ${updErr.message}`, values };
  }

  revalidatePath("/saisie-operation");
  revalidatePath("/recuperations");
  revalidatePath("/conteneurs");
  redirect("/saisie-operation?onglet=recuperations&saisi=1");
}
