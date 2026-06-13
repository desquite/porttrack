import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processBotCommand } from "@/lib/bot/process-command";
import { sendWhatsapp, sendWhatsappMedia } from "@/lib/notifications/whatsapp-wasender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook du bot WhatsApp de consultation de documents.
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
  const rawBody = await request.text();

  // --- Vérification du secret WasenderAPI (header brut) ---
  // WasenderAPI envoie le secret du webhook dans `x-webhook-secret`
  // (= `x-webhook-signature`). Si WASENDER_WEBHOOK_SECRET est configuré, on
  // exige la correspondance. Sinon (pas encore configuré) on laisse passer.
  const expectedSecret = process.env.WASENDER_WEBHOOK_SECRET;
  if (expectedSecret) {
    const got = request.headers.get("x-webhook-secret") ?? request.headers.get("x-webhook-signature");
    if (got !== expectedSecret) {
      return NextResponse.json({ ok: false, error: "bad signature" }, { status: 401 });
    }
  }

  let body: unknown = null;
  try {
    body = JSON.parse(rawBody);
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

/** Nettoie un JID WhatsApp (2250700000000@s.whatsapp.net) → numéro brut. */
function jidToNumber(jid: string): string {
  return String(jid).replace(/@(s\.whatsapp\.net|c\.us|g\.us)$/i, "").split(":")[0];
}

/** Extrait le texte d'un objet message Baileys (conversation / extendedText / caption). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textFromBaileys(message: any): string | null {
  if (!message) return null;
  const t =
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.documentMessage?.caption ??
    null;
  return typeof t === "string" && t.trim() ? t : null;
}

/**
 * Extrait { from, text } des formats supportés :
 *   - Meta Cloud API : entry[].changes[].value.messages[].{from,text.body}
 *   - WasenderAPI (Baileys messages.received) : data.messages(.[]).{key.remoteJid, message.conversation}
 *   - Générique plat : {from, message|text|body}
 * Ignore les messages sortants (fromMe) et les groupes (@g.us).
 */
function extractIncoming(body: unknown): { from: string; text: string } | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = body as any;
  if (!b || typeof b !== "object") return null;

  // 1) Meta Cloud API
  const metaMsg = b?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (metaMsg?.from) {
    const text = metaMsg?.text?.body ?? metaMsg?.button?.text ?? "";
    if (typeof text === "string" && text.trim()) return { from: String(metaMsg.from), text };
  }

  // 2) WasenderAPI / Baileys — data.messages peut être un objet OU un tableau
  const data = b.data ?? b;
  const rawMessages = data.messages ?? data.message ?? data;
  const list = Array.isArray(rawMessages) ? rawMessages : [rawMessages];
  for (const m of list) {
    if (!m || typeof m !== "object") continue;
    const key = m.key ?? {};
    if (key.fromMe === true) continue;                  // anti-boucle : nos envois

    // WhatsApp « LID addressing » : key.remoteJid peut être un identifiant
    // interne (…@lid), PAS le numéro. Le vrai numéro est dans senderPn /
    // cleanedSenderPn. On les prend en priorité.
    const jid: string | undefined =
      key.cleanedSenderPn ??
      key.senderPn ??
      m.senderPn ??
      (typeof key.remoteJid === "string" && !/@lid$/i.test(key.remoteJid) ? key.remoteJid : undefined) ??
      m.from ?? m.sender ?? m.chatId;
    if (!jid || /@g\.us$/i.test(jid)) continue;          // ignore groupes
    const text =
      textFromBaileys(m.message) ??
      (typeof m.messageBody === "string" ? m.messageBody : null) ??
      (typeof m.text === "string" ? m.text : null) ??
      (typeof m.body === "string" ? m.body : null);
    if (text) return { from: jidToNumber(jid), text };
  }

  // 3) Générique plat
  const from = data.from ?? data.sender ?? data.phone ?? data.number;
  const flatText = typeof data.message === "string" ? data.message : (data.text ?? data.body);
  if (from && typeof flatText === "string" && flatText.trim()) {
    return { from: jidToNumber(String(from)), text: flatText };
  }
  return null;
}
