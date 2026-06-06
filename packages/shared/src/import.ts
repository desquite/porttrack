/**
 * Module Import de Flux Excel — référence partagée (cahier §4).
 *
 * Chaque aconier (MEDLOG, AGL, MAERSK…) envoie un fichier Excel avec ses propres
 * en-têtes. PORTTRACK mappe ces colonnes vers un jeu de champs standard avant de
 * créer les conteneurs. Ce fichier décrit :
 *   - les champs standard cibles (FLUX_FIELDS)
 *   - les alias d'en-têtes connus par aconier (pour le mapping automatique)
 *   - la détection de l'aconier (nom de fichier + structure des colonnes)
 *
 * Le parsing binaire (.xlsx/.xls/.csv) et l'insertion en base vivent côté web.
 */

import type { ConteneurStatut } from "./constants";

// =============================================================================
// Aconiers connus
// =============================================================================

export const ACONIERS = ["MEDLOG", "MAERSK", "CMA CGM", "AGL", "AUTRE"] as const;
export type Aconier = (typeof ACONIERS)[number];

/**
 * Noms de compagnies (normalisés) trouvés dans le contenu des fichiers, qui
 * permettent de reconnaître l'aconier émetteur — typiquement via une colonne
 * « NOM » (ex. MEDLOG TRANSPORT). Plus fiable que le nom de fichier.
 *
 * Les motifs courts (≤ 3 caractères) sont comparés comme mots entiers pour
 * éviter les faux positifs ; les autres en sous-chaîne.
 */
export const ACONIER_NAME_PATTERNS: Record<Exclude<Aconier, "AUTRE">, string[]> = {
  MEDLOG: ["MEDLOG", "MEDITERRANEAN"],
  MAERSK: ["MAERSK", "SAFMARINE"],
  "CMA CGM": ["CMA CGM", "CMACGM", "DELMAS"],
  AGL: ["AGL", "BOLLORE", "AFRICA GLOBAL LOGISTICS"],
};

// =============================================================================
// Champs standard cibles de l'import
// =============================================================================
// `required` = bloquant (la ligne est rejetée si vide). Seul le numéro l'est :
// c'est la clé d'unicité et la colonne NOT NULL en base. Les autres champs
// recommandés par le cahier (client, destination, type) génèrent un simple
// avertissement plutôt qu'un rejet, pour ne pas écarter en masse des fichiers
// réels souvent incomplets.

export type FluxFieldKey =
  | "numero"
  | "type_conteneur"
  | "client"
  | "transitaire"
  | "numero_bl"
  | "destination"
  | "poids"
  | "marchandise"
  | "mode_livraison"
  | "date_do"
  | "date_badt"
  | "situation"
  | "transporteur"
  | "aconier"
  | "plomb"
  | "num_declaration"
  | "type_visite"
  | "navire_voyage";

export interface FluxFieldDef {
  key: FluxFieldKey;
  label: string;
  description: string;
  required: boolean;     // bloquant à l'import
  recommended?: boolean; // recommandé par le cahier (avertissement si vide)
}

export const FLUX_FIELDS: readonly FluxFieldDef[] = [
  { key: "numero",          label: "N° conteneur",        description: "Identifiant ISO 6346 (ex. MSCU1234567)", required: true },
  { key: "type_conteneur",  label: "Type conteneur",      description: "20DV, 40HC… (rattaché au catalogue)",    required: false, recommended: true },
  { key: "client",          label: "Client",              description: "Consignataire / destinataire final",     required: false, recommended: true },
  { key: "destination",     label: "Lieu de livraison",   description: "Adresse / ville de livraison",            required: false, recommended: true },
  { key: "transitaire",     label: "Transitaire",         description: "Commissionnaire en douane",               required: false },
  { key: "numero_bl",       label: "N° BL",               description: "Numéro de connaissement",                 required: false },
  { key: "poids",           label: "Poids (tonnes)",      description: "Converti automatiquement en kg",          required: false },
  { key: "marchandise",     label: "Marchandise",         description: "Nature du contenu",                       required: false },
  { key: "mode_livraison",  label: "Mode de livraison",   description: "CHASSIS, BENNE…",                         required: false },
  { key: "date_do",         label: "Date Delivery Order", description: "Date du Delivery Order (douane)",         required: false },
  { key: "date_badt",       label: "Date BADT",           description: "Date limite de retrait (jalon critique)", required: false },
  { key: "situation",       label: "Situation / statut",  description: "Vide = En attente",                       required: false },
  { key: "transporteur",    label: "Transporteur affecté", description: "Transporteur noté par l'aconier",        required: false },
  { key: "aconier",         label: "Aconier",             description: "Société de manutention au terminal — colonne « Aconier » (ex. MEDLOG TRANSPORT, AGL). OBLIGATOIRE.", required: true },
  { key: "plomb",           label: "Plomb / scellé",      description: "Numéro de plomb",                         required: false },
  { key: "num_declaration", label: "N° déclaration",      description: "Numéro de déclaration en douane",         required: false },
  { key: "type_visite",     label: "Type de visite",      description: "Circuit douanier (SCANNER, VISITE…)",     required: false },
  { key: "navire_voyage",   label: "Navire / voyage",     description: "Nom du navire et n° de voyage",           required: false },
] as const;

// =============================================================================
// Alias d'en-têtes (en-têtes normalisés) → champ standard
// =============================================================================
// Le mapping MEDLOG est la référence (cahier §4.2). Les variantes courantes
// sont ajoutées pour couvrir AGL/MAERSK et les fichiers légèrement différents.

export const MEDLOG_HEADER_ALIASES: Record<FluxFieldKey, string[]> = {
  numero:          ["TC", "N TC", "NUMERO TC", "NUMERO CONTENEUR", "N CONTENEUR", "CONTENEUR", "CONTAINER", "CONTAINER NO"],
  type_conteneur:  ["TYPE DE TC", "TYPE TC", "TYPE DE CONTENEUR", "TYPE CONTENEUR", "TYPE", "ISO TYPE"],
  client:          ["CLIENT", "CONSIGNATAIRE", "DESTINATAIRE", "RECEIVER"],
  transitaire:     ["TRANSITAIRE", "FORWARDER", "AGENT"],
  numero_bl:       ["BL", "N BL", "NUMERO BL", "BILL OF LADING", "CONNAISSEMENT"],
  destination:     ["LIEU DE LIVRAISON", "LIEU LIVRAISON", "ZONE DE LIVRAISON", "ZONE LIVRAISON", "DESTINATION", "ADRESSE DE LIVRAISON", "DELIVERY PLACE"],
  poids:           ["POIDS", "POIDS T", "POIDS TONNES", "TONNAGE", "WEIGHT"],
  marchandise:     ["MARCHANDISE", "NATURE", "DESCRIPTION", "COMMODITY"],
  mode_livraison:  ["MODE DE LIVRAISON", "MODE LIVRAISON", "MODE"],
  date_do:         ["DELIVERY ORDER", "DATE DELIVERY ORDER", "DATE DO", "DO"],
  date_badt:       ["BADT", "DATE BADT", "DATE LIMITE", "DATE LIMITE RETRAIT", "BON A DELIVRER", "BON A DELIVRER TERMINAL", "BON A DELIVRER LE TERMINAL", "BAD"],
  situation:       ["SITUATION", "STATUT", "ETAT", "STATUS"],
  transporteur:    ["AFFECT TRSPRT", "AFFECT TRANSPORT", "AFFECTATION TRANSPORT", "TRANSPORTEUR", "CARRIER"],
  // Aconier = colonne « Aconier » du fichier (et variantes). « NOM » a été
  // retiré volontairement : trop ambigu, il a déjà conduit à mapper une colonne
  // de dates sur l'aconier. Le fichier DOIT comporter une colonne « Aconier ».
  aconier:         ["ACONIER", "ACCONIER", "MANUTENTIONNAIRE", "MANUTENTION"],
  plomb:           ["PLOMB", "SCELLE", "PLOMB SCELLE", "SEAL", "SEAL NO"],
  num_declaration: ["N DECLARATION", "NUMERO DECLARATION", "DECLARATION", "DECLARATION DOUANE", "DECLARATION NO"],
  type_visite:     ["TYPE DE VISITE", "TYPE VISITE", "VISITE", "CIRCUIT", "CIRCUIT DOUANIER"],
  navire_voyage:   ["NAVIRE VOYAGE", "NAVIRE", "VOYAGE", "VESSEL VOYAGE", "VESSEL"],
};

// =============================================================================
// Normalisation
// =============================================================================

/** Normalise un en-tête : sans accents, MAJUSCULES, ponctuation → espace, espaces compactés. */
export function normalizeHeader(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritiques
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

// =============================================================================
// Détection de l'aconier
// =============================================================================

/**
 * Détecte l'aconier. Priorité : (1) contenu du fichier (noms de compagnie dans
 * les cellules, ex. colonne « NOM » = MEDLOG TRANSPORT), (2) nom du fichier,
 * (3) structure des colonnes. Retourne "AUTRE" si rien ne ressort.
 */
export function detectAconier(
  fileName: string,
  headers: string[],
  contentSamples?: string[],
): Aconier {
  // (1) Contenu
  if (contentSamples && contentSamples.length) {
    const byContent = detectAconierFromContent(contentSamples);
    if (byContent) return byContent;
  }
  // (2) Nom de fichier
  const fn = normalizeHeader(fileName);
  if (fn.includes("MEDLOG")) return "MEDLOG";
  if (fn.includes("MAERSK") || fn.includes("SAFMARINE")) return "MAERSK";
  if (fn.includes("CMACGM") || fn.includes("CMA CGM") || fn.includes("DELMAS")) return "CMA CGM";
  if (fn.includes("AGL") || fn.includes("BOLLORE")) return "AGL";
  // (3) Structure (le format MEDLOG est la référence)
  if (countMappableFields(headers) >= 5) return "MEDLOG";
  return "AUTRE";
}

/**
 * Cherche un nom de compagnie connu dans des cellules (en-têtes + données).
 * Les motifs ≤ 3 caractères sont comparés comme mots entiers.
 */
export function detectAconierFromContent(samples: string[]): Aconier | null {
  const normed = samples.map(normalizeHeader).filter((s) => s.length > 0);
  for (const aconier of Object.keys(ACONIER_NAME_PATTERNS) as Exclude<Aconier, "AUTRE">[]) {
    for (const pattern of ACONIER_NAME_PATTERNS[aconier]) {
      const isShort = pattern.length <= 3;
      const hit = normed.some((s) =>
        isShort ? s.split(" ").includes(pattern) : s.includes(pattern),
      );
      if (hit) return aconier;
    }
  }
  return null;
}

/** Nombre de champs standard qu'on sait mapper à partir de ces en-têtes. */
export function countMappableFields(headers: string[]): number {
  const mapping = suggestMapping(headers);
  return Object.values(mapping).filter((h) => h !== "").length;
}

// =============================================================================
// Détection du numéro de conteneur par le contenu (ISO 6346)
// =============================================================================
// Le numéro de conteneur n'a parfois AUCUN en-tête dans les fichiers réels
// (colonne sans titre). On le repère alors par sa forme : 4 lettres + 6-7
// chiffres (ex. TLLU5057849, MEDUXO668370 → MEDU + ...). Plus fiable que le nom
// de la colonne.

const ISO6346_RE = /^[A-Z]{4}\d{6,7}$/;

/** Une cellule ressemble-t-elle à un numéro de conteneur ISO 6346 ? */
export function looksLikeContainerNumber(value: string): boolean {
  const s = value.replace(/\s+/g, "").toUpperCase();
  return ISO6346_RE.test(s);
}

/**
 * Repère l'en-tête de la colonne « numéro de conteneur » en regardant le
 * contenu : la colonne dont le plus de cellules ressemblent à un n° ISO 6346.
 * `sampleRows` : lignes de valeurs (en chaînes) alignées par index aux headers.
 */
export function detectNumeroHeader(
  headers: string[],
  sampleRows: string[][],
): string | null {
  let bestIdx = -1;
  let bestCount = 0;
  for (let c = 0; c < headers.length; c++) {
    let count = 0;
    for (const row of sampleRows) {
      const v = row[c];
      if (v && looksLikeContainerNumber(v)) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      bestIdx = c;
    }
  }
  return bestCount > 0 ? headers[bestIdx] : null;
}

// =============================================================================
// Mapping automatique
// =============================================================================

export type FluxMapping = Record<FluxFieldKey, string>; // champ → en-tête (ou "")

/**
 * Propose un mapping champ standard → en-tête du fichier :
 *   1. correspondance d'alias sur le libellé de colonne ;
 *   2. si le numéro reste introuvable et que des lignes sont fournies, on le
 *      détecte par le contenu (motif ISO 6346) — gère les colonnes sans titre.
 */
export function suggestMapping(headers: string[], sampleRows?: string[][]): FluxMapping {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const used = new Set<string>();
  const out = {} as FluxMapping;

  for (const field of FLUX_FIELDS) {
    const aliases = MEDLOG_HEADER_ALIASES[field.key];
    let found = "";
    for (const alias of aliases) {
      const hit = normalized.find((h) => !used.has(h.raw) && h.norm === alias);
      if (hit) {
        found = hit.raw;
        used.add(hit.raw);
        break;
      }
    }
    out[field.key] = found;
  }

  // Fallback numéro par contenu
  if (!out.numero && sampleRows && sampleRows.length) {
    const numHeader = detectNumeroHeader(headers, sampleRows);
    if (numHeader && !used.has(numHeader)) {
      out.numero = numHeader;
      used.add(numHeader);
    }
  }

  return out;
}

// =============================================================================
// Conversions métier
// =============================================================================

/** SITUATION MEDLOG (texte libre) → statut conteneur. Vide = En attente. */
export function situationToStatut(raw: string | null | undefined): ConteneurStatut {
  const s = normalizeHeader(String(raw ?? ""));
  if (!s) return "EN_ATTENTE";
  if (s.includes("LIVR")) return "LIVRE";
  if (s.includes("ANNUL")) return "ANNULE";
  if (s.includes("COURS") || s.includes("ROUTE") || s.includes("TRANSIT") || s.includes("ENLEV"))
    return "EN_COURS";
  return "EN_ATTENTE";
}
