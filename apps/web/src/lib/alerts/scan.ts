import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@porttrack/shared";
import { classifyExpiry, formatExpiryLabel } from "@/lib/utils/dates";

type Admin = SupabaseClient<Database>;

export type AlertLine = { label: string; detail: string };

export type TenantAlertDigest = {
  tenantId: string;
  tenantName: string;
  managerEmail: string | null;
  managerPhone: string | null;
  chauffeurAlerts: AlertLine[];
  materielAlerts: AlertLine[];
  badtAlerts: AlertLine[];
  totalAlerts: number;
};

const DOC_HORIZON_DAYS = 30; // documents : alerte à J-30
const BADT_HORIZON_DAYS = 7; // BADT : jalon serré, alerte à J-7

function isoInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Scanne TOUS les tenants (via le client admin / service_role) et construit
 * un digest d'alertes par tenant. Utilisé par le cron d'alertes.
 *
 * Une alerte = un document (permis, visite médicale, assurance, VT, vignette,
 * patente, DGTTC) qui expire dans <= 30j ou a expiré, ou une BADT <= 7j.
 */
export async function scanAllTenantsForAlerts(
  admin: Admin,
): Promise<TenantAlertDigest[]> {
  const docHorizon = isoInDays(DOC_HORIZON_DAYS);
  const badtHorizon = new Date();
  badtHorizon.setDate(badtHorizon.getDate() + BADT_HORIZON_DAYS);

  // 1. Tous les tenants actifs (on n'alerte pas les CANCELLED)
  const { data: tenants } = await admin
    .from("tenants")
    .select("id, nom_entreprise, email_manager, telephone, statut")
    .neq("statut", "CANCELLED");

  if (!tenants || tenants.length === 0) return [];

  const digests: TenantAlertDigest[] = [];

  for (const tenant of tenants) {
    // -- Chauffeurs ACTIF avec permis ou visite médicale qui expire --
    const { data: chauffeurs } = await admin
      .from("chauffeurs")
      .select("prenoms, nom, permis_expiration, visite_medicale_expiration")
      .eq("tenant_id", tenant.id)
      .eq("statut", "ACTIF")
      .or(
        `permis_expiration.lte.${docHorizon},visite_medicale_expiration.lte.${docHorizon}`,
      );

    const chauffeurAlerts: AlertLine[] = [];
    for (const c of chauffeurs ?? []) {
      const nom = `${c.prenoms} ${c.nom}`;
      if (classifyExpiry(c.permis_expiration) !== "ok") {
        chauffeurAlerts.push({
          label: nom,
          detail: `permis ${formatExpiryLabel(c.permis_expiration).toLowerCase()}`,
        });
      }
      if (classifyExpiry(c.visite_medicale_expiration) !== "ok") {
        chauffeurAlerts.push({
          label: nom,
          detail: `visite médicale ${formatExpiryLabel(c.visite_medicale_expiration).toLowerCase()}`,
        });
      }
    }

    // -- Matériel EN_SERVICE avec un des 5 documents qui expire --
    const { data: materiels } = await admin
      .from("materiel_roulant")
      .select(
        "immatriculation, marque, assurance_fin, visite_technique_fin, carte_transport_fin, carte_stationnement_fin, patente_fin",
      )
      .eq("tenant_id", tenant.id)
      .eq("etat", "EN_SERVICE")
      .or(
        [
          `assurance_fin.lte.${docHorizon}`,
          `visite_technique_fin.lte.${docHorizon}`,
          `carte_transport_fin.lte.${docHorizon}`,
          `carte_stationnement_fin.lte.${docHorizon}`,
          `patente_fin.lte.${docHorizon}`,
        ].join(","),
      );

    const materielAlerts: AlertLine[] = [];
    type MatDocKey =
      | "assurance_fin"
      | "visite_technique_fin"
      | "carte_transport_fin"
      | "carte_stationnement_fin"
      | "patente_fin";
    const matDocs: Array<{ key: MatDocKey; label: string }> = [
      { key: "assurance_fin", label: "assurance" },
      { key: "visite_technique_fin", label: "visite technique" },
      { key: "carte_transport_fin", label: "carte de transport" },
      { key: "carte_stationnement_fin", label: "carte de stationnement" },
      { key: "patente_fin", label: "patente" },
    ];
    for (const m of materiels ?? []) {
      const immat = m.marque ? `${m.immatriculation} (${m.marque})` : m.immatriculation;
      for (const doc of matDocs) {
        const val = m[doc.key];
        if (classifyExpiry(val) !== "ok") {
          materielAlerts.push({
            label: immat,
            detail: `${doc.label} ${formatExpiryLabel(val).toLowerCase()}`,
          });
        }
      }
    }

    // -- Conteneurs ouverts avec BADT proche/dépassée --
    const { data: conteneurs } = await admin
      .from("conteneurs")
      .select("numero, client, date_badt")
      .eq("tenant_id", tenant.id)
      .in("statut", ["EN_ATTENTE", "EN_COURS"])
      .not("date_badt", "is", null)
      .lte("date_badt", badtHorizon.toISOString());

    const badtAlerts: AlertLine[] = (conteneurs ?? []).map((c) => {
      const dateOnly = c.date_badt ? c.date_badt.slice(0, 10) : null;
      return {
        label: c.numero,
        detail: `BADT ${formatExpiryLabel(dateOnly).toLowerCase()}${c.client ? ` — ${c.client}` : ""}`,
      };
    });

    const totalAlerts =
      chauffeurAlerts.length + materielAlerts.length + badtAlerts.length;

    if (totalAlerts > 0) {
      digests.push({
        tenantId: tenant.id,
        tenantName: tenant.nom_entreprise,
        managerEmail: tenant.email_manager,
        managerPhone: tenant.telephone,
        chauffeurAlerts,
        materielAlerts,
        badtAlerts,
        totalAlerts,
      });
    }
  }

  return digests;
}

// =============================================================================
// Formatage du message
// =============================================================================

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://porttrack-web-sigma.vercel.app";

export function formatDigestText(d: TenantAlertDigest): string {
  const lines: string[] = [`Bonjour,`, ``, `Alertes du jour pour ${d.tenantName} :`, ``];

  if (d.chauffeurAlerts.length > 0) {
    lines.push(`CHAUFFEURS (${d.chauffeurAlerts.length})`);
    for (const a of d.chauffeurAlerts) lines.push(`- ${a.label} : ${a.detail}`);
    lines.push("");
  }
  if (d.materielAlerts.length > 0) {
    lines.push(`FLOTTE (${d.materielAlerts.length})`);
    for (const a of d.materielAlerts) lines.push(`- ${a.label} : ${a.detail}`);
    lines.push("");
  }
  if (d.badtAlerts.length > 0) {
    lines.push(`BADT (${d.badtAlerts.length})`);
    for (const a of d.badtAlerts) lines.push(`- ${a.label} : ${a.detail}`);
    lines.push("");
  }

  lines.push(`Connecte-toi pour agir : ${APP_URL}/dashboard`);
  lines.push("");
  lines.push(`— PORTTRACK`);
  return lines.join("\n");
}

export function formatDigestHtml(d: TenantAlertDigest): string {
  const section = (title: string, items: AlertLine[]) =>
    items.length === 0
      ? ""
      : `<h3 style="margin:16px 0 8px;font-size:14px;color:#0f172a;">${title} (${items.length})</h3>
         <ul style="margin:0;padding-left:18px;font-size:13px;color:#334155;">
           ${items.map((a) => `<li><strong>${escapeHtml(a.label)}</strong> : ${escapeHtml(a.detail)}</li>`).join("")}
         </ul>`;

  return `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;">
      <h2 style="font-size:18px;color:#0f172a;">Alertes PORTTRACK — ${escapeHtml(d.tenantName)}</h2>
      <p style="font-size:13px;color:#64748b;">
        ${d.totalAlerts} alerte${d.totalAlerts > 1 ? "s" : ""} à traiter.
      </p>
      ${section("Chauffeurs", d.chauffeurAlerts)}
      ${section("Flotte", d.materielAlerts)}
      ${section("BADT", d.badtAlerts)}
      <p style="margin-top:24px;">
        <a href="${APP_URL}/dashboard"
           style="display:inline-block;padding:10px 20px;background:#0f172a;color:#fff;
                  text-decoration:none;border-radius:6px;font-size:13px;">
          Ouvrir le tableau de bord
        </a>
      </p>
      <hr style="margin-top:24px;border:none;border-top:1px solid #e2e8f0;">
      <p style="color:#94a3b8;font-size:11px;">
        PORTTRACK. Tu reçois cet email car tu es le
        contact d'une entreprise sur PORTTRACK.
      </p>
    </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
