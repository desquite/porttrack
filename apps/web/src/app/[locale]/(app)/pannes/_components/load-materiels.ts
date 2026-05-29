import { createClient } from "@/lib/supabase/server";
import type { MaterielOption } from "./panne-form";

/**
 * Liste tous les matériels roulants du tenant (RLS filtre).
 * Format affiché : « TIGER 01 — AA-1234-CI » si chrono renseigné, sinon
 * « AA-1234-CI ».
 *
 * NB : pas de filtre sur l'état — on peut déclarer une panne sur un MR déjà
 * en réparation (ex. ajout d'une intervention complémentaire), ou ANNULER une
 * panne pour repasser un MR en EN_SERVICE.
 */
export async function loadMaterielsForPanne(): Promise<MaterielOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("materiel_roulant")
    .select("id, immatriculation, marque, modele, etat")
    .order("immatriculation", { ascending: true });

  return (data ?? []).map((m) => ({
    id: m.id,
    label: m.marque
      ? `${m.immatriculation} — ${m.marque}${m.modele ? " " + m.modele : ""}`
      : m.immatriculation,
  }));
}
