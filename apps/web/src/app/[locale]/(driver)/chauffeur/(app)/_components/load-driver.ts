import { createClient } from "@/lib/supabase/server";

/**
 * Charge le contexte du chauffeur connecté : sa fiche + sa désignation du jour.
 * Si l'utilisateur n'est pas connecté ou pas lié à un chauffeur, chauffeur = null.
 */
export async function loadDriverContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, chauffeur: null, designation: null };

  const { data: chauffeur } = await supabase
    .from("chauffeurs")
    .select("id, nom, prenoms, telephone, tenant_id, equipe_id_defaut, permis_expiration, visite_medicale_expiration")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!chauffeur) return { user, chauffeur: null, designation: null };

  const today = new Date().toISOString().slice(0, 10);
  const { data: designation } = await supabase
    .from("designations")
    .select(`
      id, date_designation,
      materiel:materiel_roulant ( id, immatriculation, chrono, marque ),
      equipe:equipes ( nom, code, couleur, heure_debut, heure_fin )
    `)
    .eq("chauffeur_id", chauffeur.id)
    .eq("date_designation", today)
    .maybeSingle();

  return { user, chauffeur, designation };
}

/** Libellé court du camion désigné (chrono prioritaire). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function truckLabel(designation: any): string | null {
  const mr = designation?.materiel;
  if (!mr) return null;
  return mr.chrono ?? mr.immatriculation ?? null;
}

/** Premier prénom seulement (le champ prenoms peut en contenir plusieurs). */
export function firstName(prenoms: string | null | undefined): string {
  return (prenoms ?? "").trim().split(/\s+/)[0] ?? "";
}

/** Nom court à afficher : 1 prénom + nom (jamais un 3e mot). */
export function shortName(prenoms: string | null | undefined, nom: string | null | undefined): string {
  return `${firstName(prenoms)} ${nom ?? ""}`.trim();
}
