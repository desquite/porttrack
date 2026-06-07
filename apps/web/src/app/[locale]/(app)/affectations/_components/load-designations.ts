import { createClient } from "@/lib/supabase/server";

/**
 * Une désignation du jour, normalisée pour le formulaire d'affectation :
 * un chauffeur désigné avec, le cas échéant, son tracteur associé.
 *
 * Note : la table `designations` lie un chauffeur à n'importe quel matériel
 * roulant (tracteur, remorque, etc.). On filtre ici pour ne garder que les
 * couples où le matériel est un TRACTEUR (les remorques n'ont pas de sens
 * pour une affectation).
 */
export type DesignationDuJour = {
  chauffeurId: string;
  chauffeurLabel: string;
  tracteurId: string | null;
  tracteurLabel: string | null;
};

/**
 * Charge les désignations actives pour une date donnée (par défaut aujourd'hui)
 * et retourne, par chauffeur, son tracteur attribué du jour.
 *
 * - Filtre sur date_designation = date demandée
 * - Ne garde que les matériels de type TRACTEUR
 * - Filtré par RLS (tenant courant)
 */
export async function loadDesignationsDuJour(
  date: string = new Date().toISOString().slice(0, 10),
): Promise<DesignationDuJour[]> {
  const supabase = await createClient();

  const { data: designations } = await supabase
    .from("designations")
    .select(`id, chauffeur_id, materiel_roulant_id, date_designation,
             chauffeur:chauffeurs!designations_chauffeur_id_fkey ( id, prenoms, nom ),
             materiel:materiel_roulant!designations_materiel_roulant_id_fkey ( id, immatriculation, type, etat )`)
    .eq("date_designation", date);

  const rows: DesignationDuJour[] = [];
  for (const d of designations ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ch = (d as any).chauffeur as { id: string; prenoms: string | null; nom: string | null } | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mr = (d as any).materiel as { id: string; immatriculation: string; type: string; etat: string } | null;
    if (!ch) continue;

    const chauffeurLabel = `${ch.prenoms ?? ""} ${ch.nom ?? ""}`.trim() || "Chauffeur";
    // On ne garde le tracteur que s'il est de type TRACTEUR et en service.
    const isTracteur = mr?.type === "TRACTEUR" && mr.etat === "EN_SERVICE";

    rows.push({
      chauffeurId: ch.id,
      chauffeurLabel,
      tracteurId: isTracteur ? mr!.id : null,
      tracteurLabel: isTracteur ? mr!.immatriculation : null,
    });
  }

  // Tri alpha par nom de chauffeur (utile pour le combobox)
  rows.sort((a, b) => a.chauffeurLabel.localeCompare(b.chauffeurLabel, "fr"));
  return rows;
}
