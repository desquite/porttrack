"use server";

import { revalidatePath } from "next/cache";
import {
  type Aconier,
  type FluxMapping,
  type FluxImportReport,
  detectAconier,
  suggestMapping,
  situationToStatut,
  normalizeHeader,
  fluxImportMetaSchema,
} from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";
import { parseFluxFile } from "@/lib/import/parse-flux";
import {
  mapRowToStandard,
  cellToString,
  cellToNumber,
  cellToIsoDate,
  cellToDisplay,
} from "@/lib/import/normalize";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 Mo
const PREVIEW_ROWS = 8;
const INSERT_CHUNK = 100;

// =============================================================================
// Étape 1 — Analyse du fichier (détection aconier + mapping + aperçu)
// =============================================================================

export type AnalyzeFluxResult =
  | {
      ok: true;
      aconier: Aconier;
      headers: string[];
      mapping: FluxMapping;
      previewRows: Record<string, string>[]; // clés = en-têtes, valeurs d'affichage
      totalRows: number;
    }
  | { ok: false; error: string };

export async function analyzeFluxAction(
  formData: FormData,
): Promise<AnalyzeFluxResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Aucun fichier reçu." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "Fichier trop volumineux (10 Mo maximum)." };
  }
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    return { ok: false, error: "Format non supporté. Utilise un fichier .xlsx, .xls ou .csv." };
  }

  let parsed;
  try {
    parsed = await parseFluxFile(file);
  } catch (e) {
    console.error("[analyzeFluxAction] parse", e);
    return { ok: false, error: "Impossible de lire le fichier. Vérifie qu'il n'est pas corrompu." };
  }

  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    return { ok: false, error: "Le fichier ne contient aucune donnée exploitable." };
  }

  const aconier = detectAconier(file.name, parsed.headers);
  const mapping = suggestMapping(parsed.headers);

  const previewRows = parsed.rows.slice(0, PREVIEW_ROWS).map((row) => {
    const out: Record<string, string> = {};
    for (const header of parsed.headers) {
      out[header] = cellToDisplay(row[header] ?? null);
    }
    return out;
  });

  return {
    ok: true,
    aconier,
    headers: parsed.headers,
    mapping,
    previewRows,
    totalRows: parsed.rows.length,
  };
}

// =============================================================================
// Étape 2 — Import définitif (validation + dédup + insertion + flux)
// =============================================================================

interface ConteneurInsert {
  tenant_id: string;
  numero: string;
  type_conteneur_id: string | null;
  shipping_line_id: string | null;
  numero_bl: string | null;
  num_declaration: string | null;
  type_visite: string | null;
  client: string | null;
  transitaire: string | null;
  destination_id: string | null;
  destination_libre: string | null;
  marchandise: string | null;
  mode_livraison: string | null;
  transporteur: string | null;
  poids_kg: number | null;
  plomb: string | null;
  navire_voyage: string | null;
  date_do: string | null;
  date_badt: string | null;
  statut: ReturnType<typeof situationToStatut>;
  created_by: string;
  flux_id: string | null;
}

function clamp(value: string | null, max: number): string | null {
  if (value === null) return null;
  return value.length > max ? value.slice(0, max) : value;
}

function emptyReport(meta: { aconier: string; nomFichier: string }): FluxImportReport {
  return {
    fluxId: null,
    aconier: meta.aconier,
    nomFichier: meta.nomFichier,
    nombreLignes: 0,
    nombreImportes: 0,
    nombreDoublons: 0,
    nombreErreurs: 0,
    statut: "ECHEC",
    doublons: [],
    erreurs: [],
    avertissements: [],
  };
}

export async function importFluxAction(
  formData: FormData,
): Promise<FluxImportReport> {
  // --- 1. Métadonnées + fichier ---
  const file = formData.get("file");
  const metaRaw = formData.get("meta");

  let meta;
  try {
    meta = fluxImportMetaSchema.parse(JSON.parse(String(metaRaw ?? "{}")));
  } catch {
    return { ...emptyReport({ aconier: "AUTRE", nomFichier: "—" }), erreurs: [{ ligne: 0, message: "Paramètres d'import invalides." }] };
  }

  const baseReport = emptyReport(meta);

  if (!(file instanceof File) || file.size === 0) {
    return { ...baseReport, erreurs: [{ ligne: 0, message: "Aucun fichier reçu." }] };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ...baseReport, erreurs: [{ ligne: 0, message: "Fichier trop volumineux (10 Mo maximum)." }] };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ...baseReport, erreurs: [{ ligne: 0, message: "Session expirée. Reconnecte-toi." }] };
  }

  // --- 2. Parsing ---
  let parsed;
  try {
    parsed = await parseFluxFile(file);
  } catch (e) {
    console.error("[importFluxAction] parse", e);
    return { ...baseReport, erreurs: [{ ligne: 0, message: "Lecture du fichier impossible." }] };
  }

  const mapping = meta.mapping as FluxMapping;
  const nombreLignes = parsed.rows.length;

  // --- 3. Catalogues pour résolution (RLS : lecture autorisée à tout authentifié) ---
  const [{ data: types }, { data: ports }, { data: lines }] = await Promise.all([
    supabase.from("types_conteneur").select("id, code_trade").eq("actif", true),
    supabase.from("port_codes").select("id, nom_lieu").eq("actif", true),
    supabase.from("shipping_lines").select("id, code_scac").eq("actif", true),
  ]);

  const typeByCode = new Map<string, string>();
  for (const t of types ?? []) typeByCode.set(normalizeAlnum(t.code_trade), t.id);
  const portByName = new Map<string, string>();
  for (const p of ports ?? []) portByName.set(normalizeHeader(p.nom_lieu), p.id);
  const lineByScac = new Map<string, string>();
  for (const l of lines ?? []) lineByScac.set(l.code_scac.toUpperCase(), l.id);

  // --- 4. Construction des lignes à insérer ---
  const candidates: ConteneurInsert[] = [];
  const erreurs: { ligne: number; message: string }[] = [];
  const avertissements: { ligne: number; message: string }[] = [];
  const seenInBatch = new Set<string>();

  parsed.rows.forEach((row, idx) => {
    const ligne = idx + 1;
    const std = mapRowToStandard(row, mapping);

    let numero = cellToString(std.numero);
    if (!numero) {
      erreurs.push({ ligne, message: "Numéro de conteneur manquant." });
      return;
    }
    numero = numero.toUpperCase();
    if (numero.length > 20) {
      erreurs.push({ ligne, message: `Numéro trop long : « ${numero} ».` });
      return;
    }
    if (seenInBatch.has(numero)) {
      // doublon interne au fichier : compté plus bas avec les doublons base
      avertissements.push({ ligne, message: `Numéro répété dans le fichier : ${numero} (ligne ignorée).` });
      return;
    }
    seenInBatch.add(numero);

    // Type conteneur
    let typeId: string | null = null;
    const typeRaw = cellToString(std.type_conteneur);
    if (typeRaw) {
      typeId = typeByCode.get(normalizeAlnum(typeRaw)) ?? null;
      if (!typeId) {
        avertissements.push({ ligne, message: `Type conteneur non reconnu : « ${typeRaw} » (laissé vide).` });
      }
    }

    // Destination : match catalogue sinon texte libre
    let destinationId: string | null = null;
    let destinationLibre: string | null = null;
    const destRaw = cellToString(std.destination);
    if (destRaw) {
      destinationId = portByName.get(normalizeHeader(destRaw)) ?? null;
      if (!destinationId) destinationLibre = clamp(destRaw, 200);
    }

    // Compagnie maritime via préfixe ISO 6346 (4 lettres)
    const prefix = numero.slice(0, 4).toUpperCase();
    const shippingLineId = /^[A-Z]{4}$/.test(prefix) ? lineByScac.get(prefix) ?? null : null;

    // Poids : MEDLOG en tonnes → kg
    let poidsKg: number | null = null;
    const poidsT = cellToNumber(std.poids);
    if (poidsT !== null) {
      const kg = Math.round(poidsT * 1000 * 100) / 100;
      poidsKg = kg >= 0 && kg < 100_000 ? kg : null;
      if (poidsKg === null) {
        avertissements.push({ ligne, message: `Poids hors limites : ${poidsT} t (ignoré).` });
      }
    }

    const client = clamp(cellToString(std.client), 200);
    if (!client) avertissements.push({ ligne, message: "Client manquant." });
    if (!destRaw) avertissements.push({ ligne, message: "Lieu de livraison manquant." });

    candidates.push({
      tenant_id: meta.tenantId,
      numero,
      type_conteneur_id: typeId,
      shipping_line_id: shippingLineId,
      numero_bl: clamp(cellToString(std.numero_bl), 50),
      num_declaration: clamp(cellToString(std.num_declaration), 50),
      type_visite: clamp(cellToString(std.type_visite), 50),
      client,
      transitaire: clamp(cellToString(std.transitaire), 200),
      destination_id: destinationId,
      destination_libre: destinationLibre,
      marchandise: clamp(cellToString(std.marchandise), 500),
      mode_livraison: clamp(cellToString(std.mode_livraison), 100),
      transporteur: clamp(cellToString(std.transporteur), 200),
      poids_kg: poidsKg,
      plomb: clamp(cellToString(std.plomb), 50),
      navire_voyage: clamp(cellToString(std.navire_voyage), 150),
      date_do: cellToIsoDate(std.date_do),
      date_badt: cellToIsoDate(std.date_badt),
      statut: situationToStatut(cellToString(std.situation)),
      created_by: user.id,
      flux_id: null,
    });
  });

  // --- 5. Détection des doublons déjà en base (même tenant) ---
  const doublons: string[] = [];
  if (candidates.length > 0) {
    const numeros = candidates.map((c) => c.numero);
    const existing = new Set<string>();
    for (let i = 0; i < numeros.length; i += 500) {
      const chunk = numeros.slice(i, i + 500);
      const { data } = await supabase
        .from("conteneurs")
        .select("numero")
        .eq("tenant_id", meta.tenantId)
        .in("numero", chunk);
      for (const c of data ?? []) existing.add(c.numero);
    }
    if (existing.size > 0) {
      for (let i = candidates.length - 1; i >= 0; i--) {
        if (existing.has(candidates[i].numero)) {
          doublons.push(candidates[i].numero);
          candidates.splice(i, 1);
        }
      }
    }
  }

  // --- 6. Enregistrement du flux (compteurs provisoires) ---
  const provisoireStatut: FluxImportReport["statut"] =
    candidates.length === 0
      ? "ECHEC"
      : doublons.length > 0 || erreurs.length > 0
        ? "PARTIEL"
        : "TERMINE";

  const { data: flux, error: fluxError } = await supabase
    .from("flux")
    .insert({
      tenant_id: meta.tenantId,
      aconier: meta.aconier,
      nom_fichier: meta.nomFichier,
      nombre_lignes: nombreLignes,
      nombre_importes: candidates.length,
      nombre_doublons: doublons.length,
      nombre_erreurs: erreurs.length,
      statut: provisoireStatut,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (fluxError || !flux) {
    console.error("[importFluxAction] flux insert", fluxError);
    const message =
      fluxError?.code === "42501" || fluxError?.message.includes("row-level security")
        ? "Tu n'as pas les droits d'importer pour cette entreprise."
        : `Erreur d'enregistrement du flux : ${fluxError?.message ?? "inconnue"}`;
    return {
      ...baseReport,
      nombreLignes,
      nombreDoublons: doublons.length,
      nombreErreurs: erreurs.length,
      doublons,
      erreurs: [...erreurs, { ligne: 0, message }],
      avertissements,
    };
  }

  // --- 7. Insertion résiliente des conteneurs ---
  for (const c of candidates) c.flux_id = flux.id;

  let importes = 0;
  for (let i = 0; i < candidates.length; i += INSERT_CHUNK) {
    const chunk = candidates.slice(i, i + INSERT_CHUNK);
    const { error } = await supabase.from("conteneurs").insert(chunk);
    if (!error) {
      importes += chunk.length;
      continue;
    }
    // Repli ligne à ligne pour isoler les enregistrements fautifs
    for (const one of chunk) {
      const { error: oneErr } = await supabase.from("conteneurs").insert(one);
      if (oneErr) {
        erreurs.push({ ligne: 0, message: `${one.numero} : ${oneErr.message}` });
      } else {
        importes += 1;
      }
    }
  }

  const statut: FluxImportReport["statut"] =
    importes === 0
      ? "ECHEC"
      : doublons.length > 0 || erreurs.length > 0
        ? "PARTIEL"
        : "TERMINE";

  // --- 8. Mise à jour des compteurs définitifs du flux ---
  await supabase
    .from("flux")
    .update({ nombre_importes: importes, nombre_erreurs: erreurs.length, statut })
    .eq("id", flux.id);

  revalidatePath("/conteneurs");
  revalidatePath("/dashboard");

  return {
    fluxId: flux.id,
    aconier: meta.aconier,
    nomFichier: meta.nomFichier,
    nombreLignes,
    nombreImportes: importes,
    nombreDoublons: doublons.length,
    nombreErreurs: erreurs.length,
    statut,
    doublons,
    erreurs,
    avertissements,
  };
}

// =============================================================================
// Helpers
// =============================================================================

/** Normalisation alphanumérique stricte (pour matcher les codes type : 20'DV → 20DV). */
function normalizeAlnum(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
