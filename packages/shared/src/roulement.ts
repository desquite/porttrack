// =============================================================================
// Roulement du planning chauffeurs — calcul pur (cahier planning, juin 2026)
// =============================================================================
// Chaque équipe enchaîne un cycle individuel de 6 jours :
//   position 0,1 → JOUR   (2 jours)
//   position 2,3 → NUIT   (2 jours)
//   position 4,5 → REPOS  (2 jours)
// Les 3 équipes sont décalées de 2 jours (offsets 0 / 2 / 4) → à tout instant
// 1 équipe en JOUR, 1 en NUIT, 1 en REPOS.
//
// Le cycle est ancré par une DATE DE RÉFÉRENCE (= jour 1 d'un bloc, position
// paire) et l'affectation des 3 équipes aux 3 postes à cette date :
//   équipe JOUR  → position de base 0
//   équipe NUIT  → position de base 2
//   équipe REPOS → position de base 4
// Le poste d'une équipe à une date D = (basePos + joursÉcoulés) mod 6.
// Tout est recalculable à l'infini (avant/arrière) et recalable en changeant la
// date de référence (corrige un éventuel décalage terrain de ±1 jour).
// =============================================================================

export const ROULEMENT_POSTES = ["JOUR", "NUIT", "REPOS"] as const;
export type RoulementPoste = (typeof ROULEMENT_POSTES)[number];

/** Réglage du roulement (image de la table roulement_config). */
export interface RoulementConfig {
  /** Date de référence (YYYY-MM-DD) = jour 1 du bloc à cette date. */
  dateReference: string;
  /** Équipe en JOUR à la date de référence. */
  equipeJourId: string;
  /** Équipe en NUIT à la date de référence. */
  equipeNuitId: string;
  /** Équipe en REPOS à la date de référence. */
  equipeReposId: string;
}

/** Libellés courts affichés dans la grille. */
export const ROULEMENT_POSTE_LABEL: Record<RoulementPoste, string> = {
  JOUR: "Jour",
  NUIT: "Nuit",
  REPOS: "Repos",
};
/** Code 1 lettre (cellule planning). */
export const ROULEMENT_POSTE_CODE: Record<RoulementPoste, string> = {
  JOUR: "J",
  NUIT: "N",
  REPOS: "R",
};
/** Horaires indicatifs par poste. */
export const ROULEMENT_POSTE_HORAIRES: Record<RoulementPoste, string | null> = {
  JOUR: "06h – 18h",
  NUIT: "18h – 06h",
  REPOS: null,
};

/** Position de base (0/2/4) d'une équipe à la date de référence, ou null si l'équipe n'est pas dans le roulement. */
function basePosition(config: RoulementConfig, equipeId: string): number | null {
  if (equipeId === config.equipeJourId) return 0;
  if (equipeId === config.equipeNuitId) return 2;
  if (equipeId === config.equipeReposId) return 4;
  return null;
}

/** Nombre de jours calendaires entiers entre deux dates ISO (b - a). */
export function daysBetweenIso(aIso: string, bIso: string): number {
  const a = Date.parse(aIso + "T00:00:00Z");
  const b = Date.parse(bIso + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

/** Poste d'une équipe à une date donnée, ou null si l'équipe n'est pas dans le roulement. */
export function posteForEquipe(
  config: RoulementConfig,
  equipeId: string,
  dateIso: string,
): RoulementPoste | null {
  const base = basePosition(config, equipeId);
  if (base === null) return null;
  const diff = daysBetweenIso(config.dateReference, dateIso);
  const pos = (((base + diff) % 6) + 6) % 6;
  return pos < 2 ? "JOUR" : pos < 4 ? "NUIT" : "REPOS";
}

/** Quelle équipe est sur un poste donné à une date (parmi les 3 du roulement). */
export function equipeForPoste(
  config: RoulementConfig,
  poste: RoulementPoste,
  dateIso: string,
): string | null {
  for (const id of [config.equipeJourId, config.equipeNuitId, config.equipeReposId]) {
    if (posteForEquipe(config, id, dateIso) === poste) return id;
  }
  return null;
}

/** Les 3 équipes du roulement sont-elles bien renseignées et distinctes ? */
export function isRoulementConfigValide(config: RoulementConfig | null | undefined): config is RoulementConfig {
  if (!config) return false;
  const { equipeJourId, equipeNuitId, equipeReposId, dateReference } = config;
  if (!equipeJourId || !equipeNuitId || !equipeReposId || !dateReference) return false;
  return (
    equipeJourId !== equipeNuitId &&
    equipeJourId !== equipeReposId &&
    equipeNuitId !== equipeReposId
  );
}
