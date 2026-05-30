import { createClient } from "@/lib/supabase/server";
import type { AbsenceRefOption } from "./absence-form";

export async function loadChauffeurs(): Promise<AbsenceRefOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chauffeurs")
    .select("id, nom, prenoms")
    .order("nom", { ascending: true });
  return (data ?? []).map((c) => ({ id: c.id, label: `${c.nom} ${c.prenoms}` }));
}
