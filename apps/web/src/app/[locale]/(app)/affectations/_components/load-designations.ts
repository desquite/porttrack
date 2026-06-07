import { createClient } from "@/lib/supabase/server";

/**
 * Une désignation du jour, normalisée :
 * un chauffeur désigné avec, le cas échéant, son matériel attribué.
 *
 * `materielType` permet aux appelants de filtrer selon le besoin :
 *   - affectation / récupération « remorque » → garde les TRACTEUR
 *   - récupération « auto-chargeur »          → garde les AUTO_CHARGEUSE
 */
export type DesignationDuJour = {
  chauffeurId: string;
  chauffeurLabel: string;
  materielId: string | null;
  materielLabel: string | null;
  materielType: string | null;
  /** Compat : équivalent de materielId quand materielType === "TRACTEUR" */
  tracteurId: string | null;
  /** Compat : équivalent de materielLabel quand materielType === "TRACTEUR" */
  tracteurLabel: string | null;
};

/**
 * Charge les désignations actives pour une date donnée (par défaut aujourd'hui).
 * Retourne 1 ligne par couple (chauffeur, matériel attribué).
 *
 * - Filtre sur date_designation = date demandée
 * - Ne garde que les matériels EN_SERVICE
 * - Filtré par RLS (tenant courant)
 *
 * NB : la table `designations` lie un chauffeur à n'importe quel matériel
 * roulant. On expose ici le type du matériel pour que l'appelant décide quoi
 * garder (TRACTEUR pour une affectation classique, AUTO_CHARGEUSE pour une
 * récup auto-chargeur, etc.).
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
    const enService = mr?.etat === "EN_SERVICE";
    const isTracteur = enService && mr?.type === "TRACTEUR";

    rows.push({
      chauffeurId: ch.id,
      chauffeurLabel,
      materielId: enService ? mr!.id : null,
      materielLabel: enService ? mr!.immatriculation : null,
      materielType: enService ? mr!.type : null,
      tracteurId: isTracteur ? mr!.id : null,
      tracteurLabel: isTracteur ? mr!.immatriculation : null,
    });
  }

  rows.sort((a, b) => a.chauffeurLabel.localeCompare(b.chauffeurLabel, "fr"));
  return rows;
}
