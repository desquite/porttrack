import type { ChannelResult } from "./types";

/**
 * Envoi d'un message WhatsApp via WasenderAPI.
 *
 * Format (confirmé via la doc WasenderAPI) :
 *   POST https://www.wasenderapi.com/api/send-message
 *   Authorization: Bearer <token>
 *   Content-Type: application/json
 *   { "to": "+225XXXXXXXX", "text": "..." }
 *
 * Env requis :
 *   - WASENDER_API_KEY : token généré après connexion de la session WhatsApp
 *   - WASENDER_API_URL : optionnel, défaut https://www.wasenderapi.com/api/send-message
 *
 * ⚠️ WasenderAPI est un wrapper non-officiel de WhatsApp Web. Risque de
 * coupure/ban si Meta détecte l'automation. À migrer vers l'API officielle
 * Meta Cloud (via Twilio ou direct) pour la prod à volume.
 */
export async function sendWhatsapp(
  to: string,
  text: string,
): Promise<ChannelResult> {
  const apiKey = process.env.WASENDER_API_KEY;
  const url =
    process.env.WASENDER_API_URL ?? "https://www.wasenderapi.com/api/send-message";

  if (!apiKey) {
    return { channel: "whatsapp", ok: false, skipped: true, error: "WASENDER_API_KEY manquant" };
  }

  // Normalise le numéro : WasenderAPI attend un format international avec +
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
      body: JSON.stringify({ to: normalized, text }),
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
  // Doit commencer par + et avoir au moins 8 chiffres
  if (!/^\+?\d{8,15}$/.test(cleaned)) return null;
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}
