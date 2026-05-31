import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@porttrack/shared";

/**
 * Bot WhatsApp de consultation de documents (cahier v7 §7.5).
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

/** Codes acceptés → type_document (sous-ensemble matériel du cahier §7.5). */
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

/** Parse « CG AA-1234-CI » → { code, immatriculation }. */
export function parseCommand(text: string): { code: string; immatriculation: string } | null {
  const t = (text ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  const m = t.match(/^(CG|AS|VT|CT|CS|PT|DOCS)\s+([A-Z0-9-]{3,20})$/);
  if (!m) return null;
  return { code: m[1], immatriculation: m[2] };
}

const HELP_TEXT =
  "PORTTRACK — commande non reconnue.\n" +
  "Format : CODE IMMATRICULATION\n" +
  "Codes : CG (carte grise), AS (assurance), VT (visite technique), " +
  "CT (carte transport), CS (carte stationnement), PT (patente), DOCS (tous).\n" +
  "Exemple : CG AA-1234-CI";

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
    // Numéro inconnu → AUCUNE réponse (cahier §7.5), mais on journalise.
    await journal(admin, { tenant_id: null, numero, commande_brute: textRaw, statut: "NON_AUTORISE" });
    return { statut: "NON_AUTORISE", outbound: [] };
  }
  const tenantId = allow.tenant_id;

  // 2) Parsing de la commande
  const parsed = parseCommand(textRaw);
  if (!parsed) {
    await journal(admin, { tenant_id: tenantId, numero, commande_brute: textRaw, statut: "COMMANDE_INVALIDE" });
    return { statut: "COMMANDE_INVALIDE", outbound: [{ kind: "text", text: HELP_TEXT }] };
  }
  const { code, immatriculation } = parsed;

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
