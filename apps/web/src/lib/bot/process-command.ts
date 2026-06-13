import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type Database,
  type PlanAbonnement,
  planAllowsFeature,
} from "@porttrack/shared";

/**
 * Bot WhatsApp de consultation de documents.
 *
 * Reçoit une commande texte (« CG AA-1234-CI »), vérifie que le numéro est
 * autorisé, résout le matériel + document du bon tenant, et retourne la liste
 * des messages à renvoyer. Chaque consultation est journalisée.
 *
 * La fonction est PURE vis-à-vis du transport : elle ne fait aucun appel
 * WhatsApp, elle retourne juste ce qu'il faut envoyer → testable + réutilisable
 * quel que soit le provider (WasenderAPI, Meta Cloud API…).
 */

type Admin = SupabaseClient<Database>;

/** Codes acceptés → type_document (sous-ensemble matériel). */
const COMMAND_TO_DOCTYPE: Record<string, string> = {
  CG: "CARTE_GRISE",
  AS: "ASSURANCE",
  VT: "VISITE_TECHNIQUE",
  CT: "CARTE_TRANSPORT",
  CS: "CARTE_STATIONNEMENT",
  PT: "PATENTE_TRANSPORT",
};
const DOCTYPE_LABEL: Record<string, string> = {
  CARTE_GRISE: "Carte grise",
  ASSURANCE: "Assurance",
  VISITE_TECHNIQUE: "Visite technique",
  CARTE_TRANSPORT: "Carte de transport",
  CARTE_STATIONNEMENT: "Carte de stationnement",
  PATENTE_TRANSPORT: "Patente",
};

export type OutboundMessage =
  | { kind: "text"; text: string }
  | { kind: "media"; url: string; caption: string; filename: string };

export type ProcessResult = {
  statut: Database["public"]["Enums"]["bot_consultation_statut"];
  outbound: OutboundMessage[];
};

/** Normalise un numéro : retire espaces/()-, garde/ajoute le +. */
export function normalizePhone(raw: string): string | null {
  const cleaned = (raw ?? "").replace(/[\s()-]/g, "");
  if (!/^\+?\d{8,15}$/.test(cleaned)) return null;
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

/** Parse « CG AA-1234-CI » ou « SUIVI MSCU1234567 » → { code, immatriculation }. */
export function parseCommand(text: string): { code: string; immatriculation: string } | null {
  const t = (text ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  const m = t.match(/^(CG|AS|VT|CT|CS|PT|DOCS|SUIVI)\s+([A-Z0-9-]{3,20})$/);
  if (!m) return null;
  return { code: m[1], immatriculation: m[2] };
}

const HELP_TEXT =
  "PORTTRACK — commande non reconnue.\n" +
  "Documents : CODE IMMATRICULATION\n" +
  "Codes : CG (carte grise), AS (assurance), VT (visite technique), " +
  "CT (carte transport), CS (carte stationnement), PT (patente), DOCS (tous).\n" +
  "Suivi conteneur : SUIVI NUMERO\n" +
  "Exemples : CG AA-1234-CI · SUIVI MSCU1234567";

/**
 * Traite une commande entrante et journalise la consultation.
 * Retourne les messages à renvoyer au demandeur (vide = ne rien répondre).
 */
export async function processBotCommand(
  admin: Admin,
  fromRaw: string,
  textRaw: string,
): Promise<ProcessResult> {
  const numero = normalizePhone(fromRaw) ?? fromRaw;

  // 1) Autorisation : on matche sur les 8 derniers chiffres (cœur abonné CI),
  //    pour tolérer les formats 8/10 chiffres, avec/sans 0, avec/sans 225.
  const core = numero.replace(/\D/g, "").slice(-8);
  const { data: allow } = await admin
    .from("bot_whatsapp_numeros")
    .select("tenant_id")
    .eq("numero_core", core)
    .eq("actif", true)
    .limit(1)
    .maybeSingle();

  if (!allow) {
    // Numéro inconnu → AUCUNE réponse, mais on journalise.
    await journal(admin, { tenant_id: null, numero, commande_brute: textRaw, statut: "NON_AUTORISE" });
    return { statut: "NON_AUTORISE", outbound: [] };
  }
  const tenantId = allow.tenant_id;

  // 1bis) Gating de plan : le bot WhatsApp est réservé aux plans Business+
  //       (V7 §15.2). Un tenant Starter ne reçoit AUCUNE réponse (comme un
  //       numéro non autorisé), même s'il a configuré des numéros.
  const { data: tenantRow } = await admin
    .from("tenants")
    .select("plan")
    .eq("id", tenantId)
    .maybeSingle();
  if (!planAllowsFeature((tenantRow?.plan ?? null) as PlanAbonnement | null, "bot_whatsapp")) {
    await journal(admin, { tenant_id: tenantId, numero, commande_brute: textRaw, statut: "NON_AUTORISE" });
    return { statut: "NON_AUTORISE", outbound: [] };
  }

  // 2) Parsing de la commande
  const parsed = parseCommand(textRaw);
  if (!parsed) {
    await journal(admin, { tenant_id: tenantId, numero, commande_brute: textRaw, statut: "COMMANDE_INVALIDE" });
    return { statut: "COMMANDE_INVALIDE", outbound: [{ kind: "text", text: HELP_TEXT }] };
  }
  const { code, immatriculation } = parsed;

  // Commande SUIVI <numéro conteneur> → fiche de suivi
  if (code === "SUIVI") {
    return handleConteneur(admin, tenantId, numero, textRaw, immatriculation);
  }

  // 3) Résolution du matériel par immatriculation (dans le tenant)
  const { data: materiel } = await admin
    .from("materiel_roulant")
    .select("id, immatriculation, chrono")
    .eq("tenant_id", tenantId)
    .ilike("immatriculation", immatriculation)
    .maybeSingle();

  if (!materiel) {
    await journal(admin, {
      tenant_id: tenantId, numero, commande_brute: textRaw, code, immatriculation,
      statut: "MATERIEL_INTROUVABLE",
    });
    return {
      statut: "MATERIEL_INTROUVABLE",
      outbound: [{ kind: "text", text: `PORTTRACK — aucun matériel « ${immatriculation} » trouvé.` }],
    };
  }

  // 4) Résolution du/des document(s)
  type DocType = Database["public"]["Enums"]["document_type"];
  const docTypes = (code === "DOCS"
    ? Object.values(COMMAND_TO_DOCTYPE)
    : [COMMAND_TO_DOCTYPE[code]]) as DocType[];

  const { data: docs } = await admin
    .from("documents")
    .select("type_document, fichier_url, fichier_nom")
    .eq("tenant_id", tenantId)
    .eq("owner_type", "MATERIEL")
    .eq("owner_id", materiel.id)
    .in("type_document", docTypes)
    .not("fichier_url", "is", null);

  const withFiles = (docs ?? []).filter((d) => !!d.fichier_url);
  if (withFiles.length === 0) {
    await journal(admin, {
      tenant_id: tenantId, numero, commande_brute: textRaw, code, immatriculation,
      materiel_id: materiel.id, statut: "DOC_INTROUVABLE",
    });
    const what = code === "DOCS" ? "aucun document" : (DOCTYPE_LABEL[COMMAND_TO_DOCTYPE[code]] ?? "document");
    return {
      statut: "DOC_INTROUVABLE",
      outbound: [{ kind: "text", text: `PORTTRACK — ${what} disponible pour ${immatriculation}.` }],
    };
  }

  // 5) Génération des URLs signées + messages média
  const mrLabel = materiel.chrono ? `${materiel.chrono} (${materiel.immatriculation})` : materiel.immatriculation;
  const outbound: OutboundMessage[] = [];
  for (const d of withFiles) {
    const { data: signed } = await admin.storage
      .from("documents")
      .createSignedUrl(d.fichier_url as string, 300, { download: d.fichier_nom ?? undefined });
    if (!signed?.signedUrl) continue;
    const label = DOCTYPE_LABEL[d.type_document] ?? d.type_document;
    outbound.push({
      kind: "media",
      url: signed.signedUrl,
      caption: `PORTTRACK — ${label} · ${mrLabel}`,
      filename: d.fichier_nom ?? `${d.type_document}.pdf`,
    });
  }

  await journal(admin, {
    tenant_id: tenantId, numero, commande_brute: textRaw, code, immatriculation,
    materiel_id: materiel.id, statut: "REPONDU",
    details: `${outbound.length} document(s) envoyé(s)`,
  });

  return { statut: "REPONDU", outbound };
}

// =============================================================================
// Suivi conteneur (commande SUIVI <numéro>)
// =============================================================================

const CONTENEUR_STATUT_LABEL: Record<string, string> = {
  EN_ATTENTE: "En attente",
  EN_COURS: "En cours",
  LIVRE: "Livré",
  ANNULE: "Annulé",
};

function fmtDate(d: string | null | undefined): string | null {
  if (!d) return null;
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("fr-FR");
}

async function handleConteneur(
  admin: Admin,
  tenantId: string,
  numero: string,
  commandeBrute: string,
  numeroConteneur: string,
): Promise<ProcessResult> {
  const { data: c } = await admin
    .from("conteneurs")
    .select("id, numero, numero_bl, client, statut, type_visite, destination_id, destination_libre, type_conteneur_id, date_badt, date_livraison_prevue, date_livraison_reelle")
    .eq("tenant_id", tenantId)
    .ilike("numero", numeroConteneur)
    .maybeSingle();

  if (!c) {
    await journal(admin, {
      tenant_id: tenantId, numero, commande_brute: commandeBrute, code: "SUIVI",
      immatriculation: numeroConteneur, statut: "MATERIEL_INTROUVABLE", details: "conteneur introuvable",
    });
    return {
      statut: "MATERIEL_INTROUVABLE",
      outbound: [{ kind: "text", text: `PORTTRACK — aucun conteneur « ${numeroConteneur} » trouvé.` }],
    };
  }

  // Destination : libellé libre sinon nom du port/ville
  let dest: string | null = c.destination_libre ?? null;
  if (!dest && c.destination_id) {
    const { data: p } = await admin.from("port_codes").select("nom_lieu").eq("id", c.destination_id).maybeSingle();
    dest = p?.nom_lieu ?? null;
  }
  // Type conteneur (ex. 40HC)
  let typeLabel: string | null = null;
  if (c.type_conteneur_id) {
    const { data: t } = await admin.from("types_conteneur").select("code_trade").eq("id", c.type_conteneur_id).maybeSingle();
    typeLabel = t?.code_trade ?? null;
  }
  // Affectation la plus récente (chauffeur + camion)
  const { data: aff } = await admin
    .from("affectations")
    .select("chauffeur:chauffeurs ( nom, prenoms ), tracteur:materiel_roulant ( immatriculation, chrono )")
    .eq("conteneur_id", c.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = aff as any;
  const chauffeurNom = a?.chauffeur ? `${a.chauffeur.nom} ${a.chauffeur.prenoms}`.trim() : null;
  const tracteur = a?.tracteur
    ? (a.tracteur.chrono ? `${a.tracteur.chrono} (${a.tracteur.immatriculation})` : a.tracteur.immatriculation)
    : null;
  // EIR archivés
  const { count: eirCount } = await admin
    .from("eir_archives")
    .select("*", { count: "exact", head: true })
    .eq("conteneur_id", c.id);

  const livre = c.statut === "LIVRE";
  const lines: string[] = [
    "PORTTRACK – Suivi conteneur",
    `📦 ${c.numero}${typeLabel ? ` (${typeLabel})` : ""}`,
    livre && c.date_livraison_reelle
      ? `Statut : ✅ Livré le ${fmtDate(c.date_livraison_reelle)}`
      : `Statut : ${CONTENEUR_STATUT_LABEL[c.statut] ?? c.statut}`,
  ];
  if (c.client) lines.push(`Client : ${c.client}`);
  if (c.numero_bl) lines.push(`BL : ${c.numero_bl}`);
  if (dest) lines.push(`Destination : ${dest}`);
  if (c.type_visite) lines.push(`Visite douane : ${c.type_visite}`);
  const badt = fmtDate(c.date_badt);
  if (badt) lines.push(`BADT : ${badt}`);
  if (chauffeurNom) lines.push(`Chauffeur : ${chauffeurNom}`);
  if (tracteur) lines.push(`Camion : ${tracteur}`);
  const prevue = fmtDate(c.date_livraison_prevue);
  if (!livre && prevue) lines.push(`Livraison prévue : ${prevue}`);
  lines.push(`EIR : ${eirCount && eirCount > 0 ? `${eirCount} document(s) archivé(s)` : "non archivé"}`);

  await journal(admin, {
    tenant_id: tenantId, numero, commande_brute: commandeBrute, code: "SUIVI",
    immatriculation: c.numero, statut: "REPONDU", details: "suivi conteneur",
  });
  return { statut: "REPONDU", outbound: [{ kind: "text", text: lines.join("\n") }] };
}

// =============================================================================
// Journalisation
// =============================================================================

async function journal(
  admin: Admin,
  row: {
    tenant_id: string | null;
    numero: string;
    commande_brute: string;
    code?: string;
    immatriculation?: string;
    document_type?: string;
    materiel_id?: string;
    statut: Database["public"]["Enums"]["bot_consultation_statut"];
    details?: string;
  },
): Promise<void> {
  try {
    await admin.from("bot_consultations").insert({
      tenant_id: row.tenant_id,
      numero_demandeur: row.numero,
      commande_brute: row.commande_brute.slice(0, 500),
      code: row.code ?? null,
      immatriculation: row.immatriculation ?? null,
      document_type: row.document_type ?? null,
      materiel_id: row.materiel_id ?? null,
      statut: row.statut,
      details: row.details ?? null,
    });
  } catch {
    // best-effort : ne jamais faire échouer la réponse à cause du journal
  }
}
