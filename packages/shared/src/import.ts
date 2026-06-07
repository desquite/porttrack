/**
 * Module Import de Flux Excel — référence partagée (cahier §4).
 *
 * L'aconier envoie un fichier Excel avec ses propres en-têtes. PORTTRACK mappe
 * ces colonnes vers un jeu de champs standard avant de créer les conteneurs. Ce
 * fichier décrit :
 *   - les champs standard cibles (FLUX_FIELDS)
 *   - les alias d'en-têtes courants (pour le mapping automatique)
 *
 * Le nom de l'aconier est saisi par l'utilisateur (texte libre) et sert de clé
 * au profil de mapping mémorisé. Le parsing binaire (.xlsx/.xls/.csv) et
 * l'insertion en base vivent côté web.
 */

import type { ConteneurStatut } from "./constants";

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
  { key: "aconier",         label: "Aconier",             description: "Société de manutention au terminal — colonne « Aconier ». OBLIGATOIRE.", required: true },
  { key: "plomb",           label: "Plomb / scellé",      description: "Numéro de plomb",                         required: false },
  { key: "num_declaration", label: "N° déclaration",      description: "Numéro de déclaration en douane",         required: false },
  { key: "type_visite",     label: "Type de visite",      description: "Circuit douanier (SCANNER, VISITE…)",     required: false },
  { key: "navire_voyage",   label: "Navire / voyage",     description: "Nom du navire et n° de voyage",           required: false },
] as const;

// =============================================================================
// Alias d'en-têtes (en-têtes normalisés) → champ standard
// =============================================================================
// Liste des variantes d'en-têtes courantes (cahier §4.2), pour reconnaître
// automatiquement les colonnes quel que soit l'aconier émetteur.

export const HEADER_ALIASES: Record<FluxFieldKey, string[]> = {
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
    const aliases = HEADER_ALIASES[field.key];
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

/** Colonne « Situation » (texte libre) → statut conteneur. Vide = En attente. */
export function situationToStatut(raw: string | null | undefined): ConteneurStatut {
  const s = normalizeHeader(String(raw ?? ""));
  if (!s) return "EN_ATTENTE";
  if (s.includes("LIVR")) return "LIVRE";
  if (s.includes("ANNUL")) return "ANNULE";
  if (s.includes("COURS") || s.includes("ROUTE") || s.includes("TRANSIT") || s.includes("ENLEV"))
    return "EN_COURS";
  return "EN_ATTENTE";
}
