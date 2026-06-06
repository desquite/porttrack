/**
 * Bilan d'activité — calcul des bornes de période et de la période précédente.
 *
 * Une "période" = un intervalle [start, endExclusive[ ancré sur l'année civile.
 * Les indices reprennent l'usage courant :
 *  - mois : 1..12
 *  - trimestre : 1..4 (T1=jan-mars, T2=avr-juin, T3=juil-sept, T4=oct-déc)
 *  - semestre : 1..2 (S1=jan-juin, S2=juil-déc)
 *  - annee : index ignoré (toujours 1)
 *
 * Pour la comparaison N-1, on prend toujours la MÊME période un an plus tôt
 * (ex. juin 2026 vs juin 2025, T2-2026 vs T2-2025). C'est la comparaison la plus
 * naturelle pour un manager qui veut voir l'évolution annuelle.
 */

export const PERIOD_KINDS = ["mois", "trimestre", "semestre", "annee"] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];

export type Period = {
  kind: PeriodKind;
  year: number;
  /** 1..12 pour mois, 1..4 pour trim, 1..2 pour sem, 1 pour annee */
  index: number;
  /** Date ISO YYYY-MM-DD inclusive (jour du début) */
  startISO: string;
  /** Date ISO YYYY-MM-DD EXCLUSIVE (jour qui suit la fin) — pratique pour `lt` */
  endExclusiveISO: string;
  /** Date ISO YYYY-MM-DD inclusive (dernier jour de la période) */
  endInclusiveISO: string;
  /** Libellé prêt à afficher (ex. "Juin 2026", "T2 2026", "S1 2026", "2026") */
  label: string;
};

const MONTH_LABELS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function daysInMonth(year: number, month1to12: number): number {
  // Astuce JS : new Date(y, m, 0) = dernier jour du mois précédent (m est 1-indexé ici)
  return new Date(year, month1to12, 0).getDate();
}

/** Construit la période à partir du couple (kind, year, index). */
export function makePeriod(kind: PeriodKind, year: number, index: number): Period {
  const startY = year;
  let startM = 1;
  const endY = year;
  let endM = 12;
  let endD = 31;
  let label = "";

  switch (kind) {
    case "mois": {
      const m = clamp(index, 1, 12);
      startM = m; endM = m;
      endD = daysInMonth(year, m);
      label = `${MONTH_LABELS_FR[m - 1]} ${year}`;
      break;
    }
    case "trimestre": {
      const q = clamp(index, 1, 4);
      startM = (q - 1) * 3 + 1;
      endM = startM + 2;
      endD = daysInMonth(year, endM);
      label = `T${q} ${year}`;
      break;
    }
    case "semestre": {
      const s = clamp(index, 1, 2);
      startM = s === 1 ? 1 : 7;
      endM = s === 1 ? 6 : 12;
      endD = daysInMonth(year, endM);
      label = `S${s} ${year}`;
      break;
    }
    case "annee":
    default: {
      startM = 1; endM = 12; endD = 31;
      label = `${year}`;
      break;
    }
  }

  // endExclusive = endInclusive + 1 jour
  const endIncl = iso(endY, endM, endD);
  const endExcl = addDaysISO(endIncl, 1);

  return {
    kind,
    year,
    index: kind === "annee" ? 1 : index,
    startISO: iso(startY, startM, 1),
    endInclusiveISO: endIncl,
    endExclusiveISO: endExcl,
    label,
  };
}

/** Même période un an plus tôt (juin 2026 → juin 2025). */
export function previousYearPeriod(p: Period): Period {
  return makePeriod(p.kind, p.year - 1, p.index);
}

/** Période actuelle (par défaut) selon le type. */
export function currentPeriod(kind: PeriodKind, now: Date = new Date()): Period {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  switch (kind) {
    case "mois":      return makePeriod("mois", y, m);
    case "trimestre": return makePeriod("trimestre", y, Math.ceil(m / 3));
    case "semestre":  return makePeriod("semestre", y, m <= 6 ? 1 : 2);
    case "annee":     return makePeriod("annee", y, 1);
  }
}

/** Liste des 12 mois d'une année (utile pour l'histogramme annuel). */
export function monthsOfYear(year: number): Array<{
  year: number;
  month: number;
  label: string;
  startISO: string;
  endExclusiveISO: string;
}> {
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const startISO = iso(year, m, 1);
    const endExcl = iso(m + 1 > 12 ? year + 1 : year, m + 1 > 12 ? 1 : m + 1, 1);
    return {
      year,
      month: m,
      label: MONTH_LABELS_FR[i].slice(0, 3), // "Jan", "Fév", …
      startISO,
      endExclusiveISO: endExcl,
    };
  });
}

/** Liste des mois CONTENUS dans une période (ex. T2 → 3 mois ; année → 12 mois). */
export function monthsInPeriod(p: Period): Array<{
  year: number;
  month: number;
  label: string;
  startISO: string;
  endExclusiveISO: string;
}> {
  const start = parseISO(p.startISO);
  const endExcl = parseISO(p.endExclusiveISO);
  const out: Array<{
    year: number; month: number; label: string;
    startISO: string; endExclusiveISO: string;
  }> = [];
  let y = start.getFullYear();
  let m = start.getMonth() + 1;
  while (true) {
    const cur = new Date(y, m - 1, 1);
    if (cur >= endExcl) break;
    const nextM = m + 1 > 12 ? 1 : m + 1;
    const nextY = m + 1 > 12 ? y + 1 : y;
    out.push({
      year: y,
      month: m,
      label: MONTH_LABELS_FR[m - 1].slice(0, 3),
      startISO: iso(y, m, 1),
      endExclusiveISO: iso(nextY, nextM, 1),
    });
    y = nextY;
    m = nextM;
  }
  return out;
}

// ----- Utilitaires internes ----------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDaysISO(s: string, days: number): string {
  const dt = parseISO(s);
  dt.setDate(dt.getDate() + days);
  return iso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

/** Helper d'affichage : variation en % entre deux valeurs. Retourne null si la
 *  référence est 0 ou indisponible (pas de "+∞%" qui n'a pas de sens). */
export function variationPct(current: number, previous: number | null | undefined): number | null {
  if (previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Liste des années entre 2022 et l'année courante + 1 (sélecteur). */
export function selectableYears(now: Date = new Date()): number[] {
  const cur = now.getFullYear();
  const start = 2024; // à adapter si historique plus ancien
  const out: number[] = [];
  for (let y = cur + 1; y >= start; y--) out.push(y);
  return out;
}

export { MONTH_LABELS_FR };
