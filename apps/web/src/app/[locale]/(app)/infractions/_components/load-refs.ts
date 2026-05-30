import { createClient } from "@/lib/supabase/server";
import type { InfractionRefOption } from "./infraction-form";

export async function loadInfractionRefs(): Promise<{
  materiels: InfractionRefOption[];
  chauffeurs: InfractionRefOption[];
}> {
  const supabase = await createClient();
  const [{ data: materiels }, { data: chauffeurs }] = await Promise.all([
    supabase.from("materiel_roulant").select("id, immatriculation, marque").order("immatriculation", { ascending: true }),
    supabase.from("chauffeurs").select("id, nom, prenoms").order("nom", { ascending: true }),
  ]);
  return {
    materiels: (materiels ?? []).map((m) => ({
      id: m.id,
      label: m.marque ? `${m.immatriculation} — ${m.marque}` : m.immatriculation,
    })),
    chauffeurs: (chauffeurs ?? []).map((c) => ({ id: c.id, label: `${c.nom} ${c.prenoms}` })),
  };
}
