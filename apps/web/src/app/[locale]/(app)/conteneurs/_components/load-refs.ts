import { createClient } from "@/lib/supabase/server";
import type { RefOption } from "./conteneur-form";

/**
 * Charge les catalogues partagés pour alimenter les dropdowns du formulaire
 * conteneur (compagnies maritimes, types ISO, ports/villes).
 *
 * Tous les utilisateurs authentifiés peuvent lire ces tables (RLS select
 * authenticated), donc pas besoin de service_role.
 */
export async function loadConteneurRefs(): Promise<{
  shippingLines: RefOption[];
  typesConteneur: RefOption[];
  ports: RefOption[];
}> {
  const supabase = await createClient();

  const [{ data: lines }, { data: types }, { data: ports }] = await Promise.all([
    supabase
      .from("shipping_lines")
      .select("id, nom_court, code_scac")
      .eq("actif", true)
      .order("nom_court", { ascending: true }),
    supabase
      .from("types_conteneur")
      .select("id, code_trade, description_fr")
      .eq("actif", true)
      .order("code_trade", { ascending: true }),
    supabase
      .from("port_codes")
      .select("id, nom_lieu, pays_iso, kind")
      .eq("actif", true)
      .order("est_destination_courante", { ascending: false })
      .order("nom_lieu", { ascending: true }),
  ]);

  return {
    shippingLines: (lines ?? []).map((l) => ({
      id: l.id,
      label: `${l.nom_court} (${l.code_scac})`,
    })),
    typesConteneur: (types ?? []).map((t) => ({
      id: t.id,
      label: `${t.code_trade} — ${t.description_fr}`,
    })),
    ports: (ports ?? []).map((p) => ({
      id: p.id,
      label: `${p.nom_lieu} (${p.pays_iso})`,
    })),
  };
}
