/**
 * Bilan d'activité — agrégations partagées entre la page (graphes) et la route
 * d'export Excel. Ne dépend d'aucun composant React : pur calcul.
 */

import { normalizeForSearch } from "@porttrack/shared";
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

/**
 * Clé canonique pour regrouper des libellés saisis librement (aconier, zone) :
 * minuscules, sans accents, espaces multiples réduits. « Medlog Transport »,
 * « MEDLOG TRANSPORT » et « medlog  transport » → même clé → une seule ligne.
 */
export function canonLabel(raw: string | null | undefined): string {
  return normalizeForSearch(raw ?? "").replace(/\s+/g, " ");
}

/** Vote pour la graphie d'affichage d'une clé canonique (la plus fréquente gagne). */
type LabelVotes = Map<string, Map<string, number>>;

function vote(votes: LabelVotes, key: string, label: string): void {
  const v = votes.get(key) ?? new Map<string, number>();
  v.set(label, (v.get(label) ?? 0) + 1);
  votes.set(key, v);
}

function bestLabel(votes: LabelVotes, key: string): string {
  const v = votes.get(key);
  if (!v) return key;
  let best = key;
  let n = 0;
  for (const [label, count] of v) {
    if (count > n) { best = label; n = count; }
  }
  return best;
}

/** Clé + libellé brut d'un champ texte libre (vide → « (non renseigné) »). */
function keyAndLabel(raw: string | null | undefined): { key: string; label: string } {
  const t = (raw ?? "").trim();
  if (!t) return { key: ACONIER_NON_RENSEIGNE, label: ACONIER_NON_RENSEIGNE };
  return { key: canonLabel(t), label: t };
}

/**
 * Déduplique une liste de libellés bruts par clé canonique et renvoie, pour
 * chaque groupe, la graphie la plus fréquente — pour le dropdown de filtre.
 */
export function dedupeLabels(raws: Array<string | null | undefined>): string[] {
  const votes: LabelVotes = new Map();
  for (const raw of raws) {
    const t = (raw ?? "").trim();
    if (!t) continue;
    vote(votes, canonLabel(t), t);
  }
  return Array.from(votes.keys())
    .map((k) => bestLabel(votes, k))
    .sort((a, b) => a.localeCompare(b, "fr"));
}

/**
 * Agrège les conteneurs livrés par aconier, avec la comparaison N-1.
 * Le regroupement est insensible à la casse et aux accents (clé canonique) :
 * « Medlog Transport » et « MEDLOG TRANSPORT » comptent sur la même ligne,
 * affichée avec la graphie la plus fréquente.
 */
export function aggregateByAconier(
  curr: ConteneurLivre[],
  prev: ConteneurLivre[],
  typeSizeById: Map<string, number>,
): AconierRow[] {
  const buckets = new Map<string, {
    livres: number; t20: number; t40: number; tAutre: number; tonnage: number;
  }>();
  const votes: LabelVotes = new Map();

  for (const c of curr) {
    const { key, label } = keyAndLabel(c.aconier);
    vote(votes, key, label);
    const b = buckets.get(key) ?? { livres: 0, t20: 0, t40: 0, tAutre: 0, tonnage: 0 };
    b.livres++;
    const size = c.type_conteneur_id ? typeSizeById.get(c.type_conteneur_id) : undefined;
    if (size === 20) b.t20++;
    else if (size === 40) b.t40++;
    else b.tAutre++;
    b.tonnage += (c.poids_kg ?? 0) / 1000;
    buckets.set(key, b);
  }

  const prevBuckets = new Map<string, number>();
  for (const c of prev) {
    const { key } = keyAndLabel(c.aconier);
    prevBuckets.set(key, (prevBuckets.get(key) ?? 0) + 1);
  }

  const total = curr.length;
  const rows: AconierRow[] = Array.from(buckets.entries()).map(([key, b]) => {
    const prevLivres = prevBuckets.get(key) ?? 0;
    return {
      aconier: bestLabel(votes, key),
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

/**
 * Répartition par zone de livraison (destination_libre), triée décroissante.
 * Même regroupement canonique que les aconiers (KOUMASSI ZI = Koumassi Zi).
 */
export function aggregateByZone(curr: ConteneurLivre[]): Array<{ zone: string; count: number }> {
  const m = new Map<string, number>();
  const votes: LabelVotes = new Map();
  for (const c of curr) {
    const { key, label } = keyAndLabel(c.destination_libre);
    vote(votes, key, label);
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return Array.from(m.entries())
    .map(([key, count]) => ({ zone: bestLabel(votes, key), count }))
    .sort((a, b) => b.count - a.count);
}
