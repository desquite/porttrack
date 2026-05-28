import type { FluxCell } from "./parse-flux";
import type { FluxFieldKey, FluxMapping } from "@porttrack/shared";
import { FLUX_FIELDS } from "@porttrack/shared";

/**
 * Conversions d'une cellule brute vers les types attendus côté conteneur, et
 * extraction des champs standard d'une ligne via le mapping choisi.
 */

/** Cellule → texte d'affichage (aperçu). Les dates sont rendues en JJ/MM/AAAA. */
export function cellToDisplay(cell: FluxCell): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return formatDateDisplay(cell);
  if (typeof cell === "number") return String(cell);
  return String(cell).trim();
}

/** Cellule → chaîne nettoyée (ou null si vide). */
export function cellToString(cell: FluxCell): string | null {
  if (cell === null || cell === undefined) return null;
  if (cell instanceof Date) return cell.toISOString();
  const s = String(cell).trim();
  return s === "" ? null : s;
}

/** Cellule → nombre (gère la virgule décimale et les espaces), ou null. */
export function cellToNumber(cell: FluxCell): number | null {
  if (cell === null || cell === undefined) return null;
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  if (cell instanceof Date) return null;
  const cleaned = String(cell)
    .replace(/\s/g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Cellule → date ISO (YYYY-MM-DD), ou null si non interprétable.
 * Gère les Date Excel, les formats JJ/MM/AAAA et JJ-MM-AAAA (usage ivoirien) et
 * l'ISO AAAA-MM-JJ.
 */
export function cellToIsoDate(cell: FluxCell): string | null {
  if (cell === null || cell === undefined) return null;

  if (cell instanceof Date) {
    // SheetJS construit les dates en UTC : on lit les composantes UTC pour
    // éviter un décalage de ±1 jour selon le fuseau du serveur.
    return toIso(cell.getUTCFullYear(), cell.getUTCMonth() + 1, cell.getUTCDate());
  }

  const s = String(cell).trim();
  if (s === "") return null;

  // AAAA-MM-JJ (éventuellement avec heure)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return toIso(+iso[1], +iso[2], +iso[3]);

  // JJ/MM/AAAA ou JJ-MM-AAAA
  const fr = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (fr) {
    const day = +fr[1];
    const month = +fr[2];
    let year = +fr[3];
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return toIso(year, month, day);
    }
  }

  return null;
}

function toIso(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatDateDisplay(date: Date): string {
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

/**
 * Extrait les champs standard d'une ligne brute selon le mapping (champ → en-tête).
 * Retourne un enregistrement champ standard → cellule brute (null si non mappé).
 */
export function mapRowToStandard(
  row: Record<string, FluxCell>,
  mapping: FluxMapping,
): Record<FluxFieldKey, FluxCell> {
  const out = {} as Record<FluxFieldKey, FluxCell>;
  for (const field of FLUX_FIELDS) {
    const header = mapping[field.key];
    out[field.key] = header && header in row ? row[header] : null;
  }
  return out;
}
