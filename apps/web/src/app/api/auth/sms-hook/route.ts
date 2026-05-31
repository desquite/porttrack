import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsapp } from "@/lib/notifications/whatsapp-wasender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * « Send SMS Hook » de Supabase Auth (cahier Phase 5).
 *
 * Quand un chauffeur demande un code de connexion (phone OTP), Supabase appelle
 * ce endpoint avec le numéro + l'OTP. On envoie le code par WhatsApp (WasenderAPI)
 * au lieu d'un SMS payant.
 *
 * Sécurité :
 *   - Signature standardwebhooks vérifiée via SEND_SMS_HOOK_SECRET (si défini)
 *   - On n'envoie le code QUE si le numéro correspond à un chauffeur ACTIF
 *     connu (matching sur les 8 derniers chiffres, cœur abonné CI).
 *
 * Réponse : {} en cas de succès, { error: { message } } sinon (format hook Supabase).
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // 1) Vérification de signature (standardwebhooks) si secret configuré
  const secret = process.env.SEND_SMS_HOOK_SECRET;
  if (secret) {
    if (!verifyStandardWebhook(rawBody, request.headers, secret)) {
      return NextResponse.json({ error: { message: "Signature invalide" } }, { status: 401 });
    }
  }

  // 2) Extraction { phone, otp }
  let phone: string | null = null;
  let otp: string | null = null;
  try {
    const body = JSON.parse(rawBody);
    phone = body?.user?.phone ?? body?.phone ?? null;
    otp = body?.sms?.otp ?? body?.otp ?? null;
  } catch {
    return NextResponse.json({ error: { message: "Payload invalide" } }, { status: 400 });
  }
  if (!phone || !otp) {
    return NextResponse.json({ error: { message: "Numéro ou code manquant" } }, { status: 400 });
  }

  const core = phone.replace(/\D/g, "").slice(-8);

  // 3) Le numéro doit être un chauffeur ACTIF connu (matching cœur)
  const admin = createAdminClient();
  const { data: chauffeurs } = await admin
    .from("chauffeurs")
    .select("id, prenoms, nom, telephone, telephone_secondaire, statut")
    .eq("statut", "ACTIF");

  const match = (chauffeurs ?? []).find((c) => {
    const t1 = (c.telephone ?? "").replace(/\D/g, "").slice(-8);
    const t2 = (c.telephone_secondaire ?? "").replace(/\D/g, "").slice(-8);
    return t1 === core || t2 === core;
  });

  if (!match) {
    // Numéro non reconnu → on refuse l'envoi (le chauffeur ne pourra pas se connecter)
    return NextResponse.json(
      { error: { http_code: 403, message: "Numéro non reconnu. Contacte ton entreprise." } },
      { status: 200 },
    );
  }

  // 4) Envoi du code par WhatsApp au numéro ENREGISTRÉ du chauffeur (canal
  //    de livraison éprouvé par les désignations V3b), pas au numéro brut.
  //    Le code est en PREMIER (lisible direct dans la notif / autofill).
  const message =
    `${otp}\n\n` +
    `Code de connexion PORTTRACK. Valable quelques minutes, ne le partage avec personne.`;
  const result = await sendWhatsapp(match.telephone, message);

  if (!result.ok) {
    return NextResponse.json(
      { error: { http_code: 500, message: result.error ?? "Envoi WhatsApp impossible" } },
      { status: 200 },
    );
  }

  return NextResponse.json({});
}

/** Vérifie la signature standardwebhooks (headers webhook-id/timestamp/signature). */
function verifyStandardWebhook(body: string, headers: Headers, secret: string): boolean {
  try {
    const id = headers.get("webhook-id");
    const ts = headers.get("webhook-timestamp");
    const sigHeader = headers.get("webhook-signature");
    if (!id || !ts || !sigHeader) return false;

    // secret au format "v1,whsec_<base64>" ou "whsec_<base64>" ou base64 brut
    const b64 = secret.replace(/^v1,/, "").replace(/^whsec_/, "");
    const key = Buffer.from(b64, "base64");

    const signed = `${id}.${ts}.${body}`;
    const expected = createHmac("sha256", key).update(signed).digest("base64");

    // webhook-signature : "v1,<sig> v1,<sig2>"
    const provided = sigHeader.split(" ").map((p) => p.split(",")[1] ?? p);
    return provided.some((sig) => {
      try {
        const a = Buffer.from(sig, "base64");
        const b = Buffer.from(expected, "base64");
        return a.length === b.length && timingSafeEqual(a, b);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}
