import * as XLSX from "xlsx";
import { normalizeHeader, HEADER_ALIASES } from "@porttrack/shared";

/**
 * Parsing serveur d'un fichier de flux aconier (.xlsx / .xls / .csv).
 *
 * Renvoie les en-têtes et les lignes brutes (valeurs typées : string, number ou
 * Date). Le mapping et la conversion vers les champs conteneur se font ensuite
 * à partir de ces données.
 */

export type FluxCell = string | number | boolean | Date | null;

export interface ParsedFlux {
  headers: string[];                       // libellés uniques (colonnes sans titre → "Colonne N")
  rows: Record<string, FluxCell>[];
  samples: Record<string, string>;         // header → 1ʳᵉ valeur non vide (aide à reconnaître la colonne)
}

const MAX_ROWS = 5000; // garde-fou : un flux raisonnable dépasse rarement quelques centaines de lignes

/** Tous les alias connus, normalisés, pour repérer la ligne d'en-tête. */
const ALL_ALIASES = new Set(
  Object.values(HEADER_ALIASES).flat(),
);

export async function parseFluxFile(file: File): Promise<ParsedFlux> {
  const isCsv = /\.csv$/i.test(file.name);

  let workbook: XLSX.WorkBook;
  if (isCsv) {
    const text = await file.text();
    workbook = XLSX.read(text, { type: "string", cellDates: true, raw: false });
  } else {
    const buffer = new Uint8Array(await file.arrayBuffer());
    workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Le fichier ne contient aucune feuille de calcul.");
  }
  const sheet = workbook.Sheets[sheetName];

  // Lecture en tableau de tableaux pour pouvoir détecter la vraie ligne d'en-tête
  // (les fichiers aconiers ont parfois une bannière/titre avant les colonnes).
  const matrix = XLSX.utils.sheet_to_json<FluxCell[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });

  if (matrix.length === 0) {
    return { headers: [], rows: [], samples: {} };
  }

  const headerRowIndex = findHeaderRow(matrix);
  const rawHeaders = matrix[headerRowIndex] ?? [];
  const colCount = matrix.reduce((max, row) => Math.max(max, row?.length ?? 0), rawHeaders.length);

  // Libellés d'en-tête : colonne sans titre → "Colonne N", puis dédoublonnage
  // (certains fichiers réels répètent un même libellé, ex. « CODE », « DATE DE RE »).
  const seen = new Map<string, number>();
  const headers: string[] = [];
  for (let i = 0; i < colCount; i++) {
    const base = cellToText(rawHeaders[i]).trim() || `Colonne ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    headers.push(n === 1 ? base : `${base} (${n})`);
  }

  const rows: Record<string, FluxCell>[] = [];
  for (let r = headerRowIndex + 1; r < matrix.length && rows.length < MAX_ROWS; r++) {
    const cells = matrix[r] ?? [];
    if (isRowEmpty(cells)) continue;

    const row: Record<string, FluxCell> = {};
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]] = cells[c] ?? null;
    }
    rows.push(row);
  }

  // Échantillon : 1ʳᵉ valeur non vide par colonne (pour les en-têtes vides surtout)
  const samples: Record<string, string> = {};
  for (const h of headers) {
    for (const row of rows) {
      const display = sampleDisplay(row[h]);
      if (display) {
        samples[h] = display;
        break;
      }
    }
  }

  return { headers, rows, samples };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Repère l'index de la ligne d'en-tête : celle qui contient le plus de cellules
 * correspondant à un alias connu (dans les 15 premières lignes). Repli sur 0.
 */
function findHeaderRow(matrix: FluxCell[][]): number {
  const limit = Math.min(matrix.length, 15);
  let best = 0;
  let bestScore = 0;
  for (let r = 0; r < limit; r++) {
    const cells = matrix[r] ?? [];
    let score = 0;
    for (const cell of cells) {
      const norm = normalizeHeader(cellToText(cell));
      if (norm && ALL_ALIASES.has(norm)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return bestScore >= 2 ? best : 0;
}

function isRowEmpty(cells: FluxCell[]): boolean {
  return cells.every((c) => c === null || c === undefined || String(c).trim() === "");
}

/** Représentation texte brute d'une cellule (sans conversion métier). */
function cellToText(cell: FluxCell): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return cell.toISOString();
  return String(cell);
}

/** Valeur courte et lisible pour l'échantillon d'une colonne (dates → JJ/MM/AAAA). */
function sampleDisplay(cell: FluxCell): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) {
    return `${String(cell.getUTCDate()).padStart(2, "0")}/${String(cell.getUTCMonth() + 1).padStart(2, "0")}/${cell.getUTCFullYear()}`;
  }
  const s = String(cell).trim();
  return s.length > 24 ? s.slice(0, 24) + "…" : s;
}
