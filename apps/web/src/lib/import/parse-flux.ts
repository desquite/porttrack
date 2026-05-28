import * as XLSX from "xlsx";
import { normalizeHeader, MEDLOG_HEADER_ALIASES } from "@porttrack/shared";

/**
 * Parsing serveur d'un fichier de flux aconier (.xlsx / .xls / .csv).
 *
 * Renvoie les en-têtes et les lignes brutes (valeurs typées : string, number ou
 * Date). La détection de l'aconier, le mapping et la conversion vers les champs
 * conteneur se font ensuite à partir de ces données.
 */

export type FluxCell = string | number | boolean | Date | null;

export interface ParsedFlux {
  headers: string[];
  rows: Record<string, FluxCell>[];
}

const MAX_ROWS = 5000; // garde-fou : un flux raisonnable dépasse rarement quelques centaines de lignes

/** Tous les alias connus, normalisés, pour repérer la ligne d'en-tête. */
const ALL_ALIASES = new Set(
  Object.values(MEDLOG_HEADER_ALIASES).flat(),
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
    return { headers: [], rows: [] };
  }

  const headerRowIndex = findHeaderRow(matrix);
  const rawHeaders = matrix[headerRowIndex] ?? [];

  // Normalise les libellés d'en-tête (string non vide, fallback COL_n)
  const headers: string[] = rawHeaders.map((cell, i) => {
    const label = cellToText(cell).trim();
    return label === "" ? `COL_${i + 1}` : label;
  });

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

  return { headers, rows };
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
