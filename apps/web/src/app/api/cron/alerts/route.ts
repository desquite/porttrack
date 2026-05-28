import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  scanAllTenantsForAlerts,
  formatDigestText,
  formatDigestHtml,
} from "@/lib/alerts/scan";
import { notify } from "@/lib/notifications";

// Force le runtime Node (le client admin + fetch ont besoin du runtime complet)
export const runtime = "nodejs";
// Pas de cache : on veut un scan frais à chaque exécution
export const dynamic = "force-dynamic";

/**
 * Cron d'alertes PORTTRACK.
 *
 * Déclenché quotidiennement par Vercel Cron (cf vercel.json). Scanne tous
 * les tenants, construit un digest d'alertes (documents expirants + BADT),
 * et l'envoie au contact de chaque tenant par email ET WhatsApp.
 *
 * Sécurité : Vercel ajoute automatiquement `Authorization: Bearer ${CRON_SECRET}`
 * si la variable CRON_SECRET est définie. On refuse toute requête sans ce
 * header. (Permet aussi un déclenchement manuel via curl avec le bon secret.)
 */
export async function GET(request: NextRequest) {
  // -------- Authentification du cron --------
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  // Si CRON_SECRET n'est pas défini, on refuse par défaut (fail-safe) sauf en dev
  else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "CRON_SECRET non configuré" },
      { status: 500 },
    );
  }

  const admin = createAdminClient();

  // -------- Scan --------
  let digests;
  try {
    digests = await scanAllTenantsForAlerts(admin);
  } catch (e: unknown) {
    console.error("[cron/alerts] scan error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "scan failed" },
      { status: 500 },
    );
  }

  // -------- Envoi --------
  const results: Array<{
    tenant: string;
    alerts: number;
    channels: { channel: string; ok: boolean; skipped?: boolean; error?: string }[];
  }> = [];

  for (const digest of digests) {
    const channels = await notify(
      { email: digest.managerEmail, phone: digest.managerPhone },
      {
        subject: `PORTTRACK — ${digest.totalAlerts} alerte${digest.totalAlerts > 1 ? "s" : ""} (${digest.tenantName})`,
        textBody: formatDigestText(digest),
        htmlBody: formatDigestHtml(digest),
      },
    );
    results.push({
      tenant: digest.tenantName,
      alerts: digest.totalAlerts,
      channels,
    });
  }

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    tenantsWithAlerts: digests.length,
    results,
  });
}
