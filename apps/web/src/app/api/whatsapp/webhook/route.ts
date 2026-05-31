import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processBotCommand } from "@/lib/bot/process-command";
import { sendWhatsapp, sendWhatsappMedia } from "@/lib/notifications/whatsapp-wasender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook du bot WhatsApp de consultation de documents (cahier §7.5).
 *
 * GET  : vérification d'abonnement (Meta Cloud API renvoie un challenge).
 * POST : réception d'un message entrant → traitement → réponse + journal.
 *
 * Env :
 *   WHATSAPP_VERIFY_TOKEN  : token de vérification du webhook (GET Meta)
 *   (WASENDER_* pour l'envoi des réponses)
 */

// -------- Vérification d'abonnement (Meta) --------
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && verifyToken && token === verifyToken) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// -------- Réception d'un message entrant --------
export async function POST(request: NextRequest) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const incoming = extractIncoming(body);
  if (!incoming) {
    // Rien d'exploitable (accusé de réception, statut de livraison…) → 200 pour
    // éviter les retries du provider.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const admin = createAdminClient();

  try {
    const result = await processBotCommand(admin, incoming.from, incoming.text);

    // Envoi des réponses (best-effort ; si l'envoi média échoue, on retombe
    // sur un lien texte).
    for (const msg of result.outbound) {
      if (msg.kind === "text") {
        await sendWhatsapp(incoming.from, msg.text);
      } else {
        const sent = await sendWhatsappMedia(incoming.from, msg.url, msg.caption);
        if (!sent.ok && !sent.skipped) {
          await sendWhatsapp(incoming.from, `${msg.caption}\n${msg.url}`);
        }
      }
    }

    return NextResponse.json({ ok: true, statut: result.statut, sent: result.outbound.length });
  } catch (e) {
    console.error("[whatsapp webhook]", e);
    // 200 quand même : on ne veut pas que le provider rejoue indéfiniment.
    return NextResponse.json({ ok: false });
  }
}

/**
 * Extrait { from, text } de plusieurs formats de payload possibles :
 *   - Meta Cloud API : entry[].changes[].value.messages[].{from,text.body}
 *   - WasenderAPI / générique : {from, message|text|body} ou {data:{...}}
 */
function extractIncoming(body: unknown): { from: string; text: string } | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = body as any;
  if (!b || typeof b !== "object") return null;

  // Meta Cloud API
  const metaMsg = b?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (metaMsg?.from) {
    const text = metaMsg?.text?.body ?? metaMsg?.button?.text ?? "";
    if (typeof text === "string" && text.trim()) return { from: String(metaMsg.from), text };
  }

  // WasenderAPI / générique (plusieurs variantes observées)
  const d = b.data ?? b;
  const from = d.from ?? d.sender ?? d.phone ?? d.number ?? d?.key?.remoteJid;
  const text = d.message ?? d.text ?? d.body ?? d?.message?.conversation ?? d?.text?.body;
  if (from && typeof text === "string" && text.trim()) {
    return { from: String(from).replace(/@s\.whatsapp\.net$/, ""), text };
  }
  return null;
}
