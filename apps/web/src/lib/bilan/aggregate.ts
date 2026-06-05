/**
 * Bilan d'activité — agrégations partagées entre la page (graphes) et la route
 * d'export Excel. Ne dépend d'aucun composant React : pur calcul.
 */

import { variationPct } from "./periods";

export type ConteneurLivre = {
  id: string;
  aconier: string | null;
  type_conteneur_id: string | null;
  destination_libre: string | null;
  poids_kg: number | null;
  date_livraison_reelle: string;
};

export type AconierRow = {
  aconier: string;
  livres: number;
  partPct: number;
  taille20: number;
  taille40: number;
  tailleAutre: number;
  tonnage: number;
  prevLivres: number;
  variationPct: number | null;
};

export const ACONIER_NON_RENSEIGNE = "(non renseigné)";

/** True si la date ISO (YYYY-MM-DD) est dans [startIncl, endExcl[. */
export function inRange(iso: string, startIncl: string, endExcl: string): boolean {
  return iso >= startIncl && iso < endExcl;
}

/** Agrège les conteneurs livrés par aconier, avec la comparaison N-1. */
export function aggregateByAconier(
  curr: ConteneurLivre[],
  prev: ConteneurLivre[],
  typeSizeById: Map<string, number>,
): AconierRow[] {
  const buckets = new Map<string, {
    livres: number; t20: number; t40: number; tAutre: number; tonnage: number;
  }>();

  for (const c of curr) {
    const k = (c.aconier ?? "").trim() || ACONIER_NON_RENSEIGNE;
    const b = buckets.get(k) ?? { livres: 0, t20: 0, t40: 0, tAutre: 0, tonnage: 0 };
    b.livres++;
    const size = c.type_conteneur_id ? typeSizeById.get(c.type_conteneur_id) : undefined;
    if (size === 20) b.t20++;
    else if (size === 40) b.t40++;
    else b.tAutre++;
    b.tonnage += (c.poids_kg ?? 0) / 1000;
    buckets.set(k, b);
  }

  const prevBuckets = new Map<string, number>();
  for (const c of prev) {
    const k = (c.aconier ?? "").trim() || ACONIER_NON_RENSEIGNE;
    prevBuckets.set(k, (prevBuckets.get(k) ?? 0) + 1);
  }

  const total = curr.length;
  const rows: AconierRow[] = Array.from(buckets.entries()).map(([aconier, b]) => {
    const prevLivres = prevBuckets.get(aconier) ?? 0;
    return {
      aconier,
      livres: b.livres,
      partPct: total > 0 ? (b.livres / total) * 100 : 0,
      taille20: b.t20,
      taille40: b.t40,
      tailleAutre: b.tAutre,
      tonnage: b.tonnage,
      prevLivres,
      variationPct: variationPct(b.livres, prevLivres),
    };
  });
  rows.sort((a, b) => b.livres - a.livres);
  return rows;
}

/** Répartition par zone de livraison (destination_libre), triée décroissante. */
export function aggregateByZone(curr: ConteneurLivre[]): Array<{ zone: string; count: number }> {
  const m = new Map<string, number>();
  for (const c of curr) {
    const z = (c.destination_libre ?? "").trim() || ACONIER_NON_RENSEIGNE;
    m.set(z, (m.get(z) ?? 0) + 1);
  }
  return Array.from(m.entries())
    .map(([zone, count]) => ({ zone, count }))
    .sort((a, b) => b.count - a.count);
}
