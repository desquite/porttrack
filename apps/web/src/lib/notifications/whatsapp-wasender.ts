import type { ChannelResult } from "./types";

/**
 * Envoi d'un message WhatsApp via WasenderAPI.
 *
 * Format ALIGNÉ sur l'implémentation éprouvée du projet muscu-pwa :
 *   POST https://wasenderapi.com/api/send-message
 *   Authorization: Bearer <WASENDER_API_KEY>
 *   Content-Type: application/json
 *   { "sessionId": "...", "to": "+225XXXXXXXX", "text": "..." }
 *
 * Env requis :
 *   - WASENDER_API_KEY    : token du compte WasenderAPI
 *   - WASENDER_SESSION_ID : id de la session WhatsApp connectée
 *   - WASENDER_API_URL    : optionnel, défaut https://wasenderapi.com/api/send-message
 *
 * ⚠️ WasenderAPI est un wrapper non-officiel de WhatsApp Web. Risque de
 * coupure/ban si Meta détecte l'automation. À migrer vers l'API officielle
 * Meta Cloud pour la prod à volume.
 */
export async function sendWhatsapp(
  to: string,
  text: string,
): Promise<ChannelResult> {
  const apiKey = process.env.WASENDER_API_KEY;
  const sessionId = process.env.WASENDER_SESSION_ID;
  const url =
    process.env.WASENDER_API_URL ?? "https://wasenderapi.com/api/send-message";

  if (!apiKey || !sessionId) {
    return {
      channel: "whatsapp",
      ok: false,
      skipped: true,
      error: "WASENDER_API_KEY ou WASENDER_SESSION_ID manquant",
    };
  }

  const normalized = normalizePhone(to);
  if (!normalized) {
    return { channel: "whatsapp", ok: false, error: `Numéro invalide: ${to}` };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId, to: normalized, text }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        channel: "whatsapp",
        ok: false,
        error: `WasenderAPI ${res.status}: ${detail.slice(0, 200)}`,
      };
    }
    return { channel: "whatsapp", ok: true };
  } catch (e: unknown) {
    return {
      channel: "whatsapp",
      ok: false,
      error: e instanceof Error ? e.message : "Erreur réseau WasenderAPI",
    };
  }
}

/**
 * Nettoie un numéro pour WasenderAPI : retire espaces/parenthèses/tirets,
 * garde le + initial. Retourne null si trop court pour être valide.
 */
function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s()-]/g, "");
  if (!/^\+?\d{8,15}$/.test(cleaned)) return null;
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}
