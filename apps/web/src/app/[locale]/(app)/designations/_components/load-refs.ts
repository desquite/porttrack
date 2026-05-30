import { createClient } from "@/lib/supabase/server";
import type { DesignationRefOption } from "./designation-form";

/**
 * Charge les chauffeurs et matériels « désignables » pour une date donnée :
 *   * Chauffeurs : statut ACTIF et pas en absence ce jour-là.
 *   * Matériels : état EN_SERVICE.
 *
 * Si une désignation existe déjà pour ce jour, on inclut quand même le
 * chauffeur/matériel concerné (utile à l'édition côté form, ou pour repérer
 * qu'il est déjà pris — la contrainte unique fera l'erreur côté DB).
 */
export async function loadDesignationRefs(date: string): Promise<{
  chauffeurs: DesignationRefOption[];
  materiels: DesignationRefOption[];
}> {
  const supabase = await createClient();

  const [{ data: chauffeurs }, { data: materiels }, { data: absences }] = await Promise.all([
    supabase
      .from("chauffeurs")
      .select("id, nom, prenoms, telephone, statut")
      .eq("statut", "ACTIF")
      .order("nom", { ascending: true }),
    supabase
      .from("materiel_roulant")
      .select("id, immatriculation, chrono, marque, etat")
      .eq("etat", "EN_SERVICE")
      .order("immatriculation", { ascending: true }),
    supabase
      .from("absences")
      .select("chauffeur_id, date_debut, date_fin")
      .lte("date_debut", date)
      .gte("date_fin", date),
  ]);

  const absentIds = new Set((absences ?? []).map((a) => a.chauffeur_id));

  return {
    chauffeurs: (chauffeurs ?? [])
      .filter((c) => !absentIds.has(c.id))
      .map((c) => ({
        id: c.id,
        label: c.telephone ? `${c.nom} ${c.prenoms} — ${c.telephone}` : `${c.nom} ${c.prenoms}`,
      })),
    materiels: (materiels ?? []).map((m) => ({
      id: m.id,
      label: m.chrono
        ? `${m.chrono} (${m.immatriculation})${m.marque ? ` — ${m.marque}` : ""}`
        : m.immatriculation,
    })),
  };
}
