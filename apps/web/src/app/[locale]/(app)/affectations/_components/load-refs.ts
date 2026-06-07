import { MATERIEL_TYPES } from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";

export type RefOption = { id: string; label: string };

// Tout type de matériel SAUF le tracteur compte comme « porteur de conteneur »
// dans les sélecteurs « remorque » (remorques classiques, semi-remorques,
// châssis porte-conteneur 20/40/mixte, REMORQUE_20/40, etc.). On dérive le set
// depuis l'enum partagé pour ne pas oublier les futurs types (cf. migration #28
// qui a ajouté REMORQUE_20 / REMORQUE_40 / AUTO_CHARGEUSE — l'ancien filtre en
// dur les ignorait et la remorque n'apparaissait pas dans les listes).
const REMORQUE_TYPES = new Set<string>(MATERIEL_TYPES.filter((t) => t !== "TRACTEUR"));

/**
 * Charge les options pour le formulaire d'affectation :
 *   - conteneurs encore "ouverts" (pas LIVRE ni ANNULE)
 *   - chauffeurs ACTIF
 *   - tracteurs EN_SERVICE
 *   - remorques/châssis EN_SERVICE
 *
 * Filtré par RLS → ne renvoie que le tenant courant (ou tout si SUPER_ADMIN).
 *
 * Optionnellement, on inclut les entités déjà liées à l'affectation en cours
 * d'édition (extraIds) même si elles ne matchent plus les filtres (ex. un
 * conteneur passé LIVRE), pour ne pas les faire disparaître du dropdown.
 */
export async function loadAffectationRefs(extra?: {
  conteneurId?: string | null;
  chauffeurId?: string | null;
  tracteurId?: string | null;
  remorqueId?: string | null;
}): Promise<{
  conteneurs: RefOption[];
  chauffeurs: RefOption[];
  tracteurs: RefOption[];
  remorques: RefOption[];
}> {
  const supabase = await createClient();

  const [{ data: conteneurs }, { data: chauffeurs }, { data: materiels }] =
    await Promise.all([
      supabase
        .from("conteneurs")
        .select("id, numero, client, statut")
        .order("created_at", { ascending: false }),
      supabase
        .from("chauffeurs")
        .select("id, prenoms, nom, statut")
        .order("nom", { ascending: true }),
      supabase
        .from("materiel_roulant")
        .select("id, immatriculation, marque, type, etat")
        .order("immatriculation", { ascending: true }),
    ]);

  // Conteneurs : on garde les ouverts + celui déjà lié (édition)
  const conteneurOptions: RefOption[] = (conteneurs ?? [])
    .filter(
      (c) =>
        c.statut === "EN_ATTENTE" ||
        c.statut === "EN_COURS" ||
        c.id === extra?.conteneurId,
    )
    .map((c) => ({
      id: c.id,
      label: c.client ? `${c.numero} — ${c.client}` : c.numero,
    }));

  // Chauffeurs : ACTIF + celui déjà lié
  const chauffeurOptions: RefOption[] = (chauffeurs ?? [])
    .filter((c) => c.statut === "ACTIF" || c.id === extra?.chauffeurId)
    .map((c) => ({ id: c.id, label: `${c.prenoms} ${c.nom}` }));

  // Tracteurs : type TRACTEUR + EN_SERVICE + celui déjà lié
  const tracteurOptions: RefOption[] = (materiels ?? [])
    .filter(
      (m) =>
        (m.type === "TRACTEUR" && m.etat === "EN_SERVICE") ||
        m.id === extra?.tracteurId,
    )
    .map((m) => ({
      id: m.id,
      label: `${m.immatriculation}${m.marque ? ` — ${m.marque}` : ""}`,
    }));

  // Remorques : tout type non-TRACTEUR + EN_SERVICE + celle déjà liée
  const remorqueOptions: RefOption[] = (materiels ?? [])
    .filter(
      (m) =>
        (REMORQUE_TYPES.has(m.type) && m.etat === "EN_SERVICE") ||
        m.id === extra?.remorqueId,
    )
    .map((m) => ({
      id: m.id,
      label: `${m.immatriculation}${m.marque ? ` — ${m.marque}` : ""}`,
    }));

  return {
    conteneurs: conteneurOptions,
    chauffeurs: chauffeurOptions,
    tracteurs: tracteurOptions,
    remorques: remorqueOptions,
  };
}
