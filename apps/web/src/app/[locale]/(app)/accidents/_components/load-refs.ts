import { createClient } from "@/lib/supabase/server";
import type { AccidentRefOption } from "./accident-form";

/**
 * Charge la liste des matériels roulants et chauffeurs pour les dropdowns
 * du formulaire accident. RLS filtre par tenant.
 */
export async function loadAccidentRefs(): Promise<{
  materiels: AccidentRefOption[];
  chauffeurs: AccidentRefOption[];
}> {
  const supabase = await createClient();
  const [{ data: materiels }, { data: chauffeurs }] = await Promise.all([
    supabase
      .from("materiel_roulant")
      .select("id, immatriculation, marque, modele")
      .order("immatriculation", { ascending: true }),
    supabase
      .from("chauffeurs")
      .select("id, nom, prenoms")
      .eq("statut", "ACTIF")
      .order("nom", { ascending: true }),
  ]);

  return {
    materiels: (materiels ?? []).map((m) => ({
      id: m.id,
      label: m.marque
        ? `${m.immatriculation} — ${m.marque}${m.modele ? " " + m.modele : ""}`
        : m.immatriculation,
    })),
    chauffeurs: (chauffeurs ?? []).map((c) => ({
      id: c.id,
      label: `${c.nom} ${c.prenoms}`,
    })),
  };
}
