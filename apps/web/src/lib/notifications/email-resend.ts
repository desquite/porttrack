import type { ChannelResult, NotificationMessage } from "./types";

/**
 * Envoi d'email via l'API Resend (https://api.resend.com/emails).
 *
 * Env requis :
 *   - RESEND_API_KEY : clé `re_...`
 *   - RESEND_FROM    : expéditeur, ex. "PORTTRACK <onboarding@resend.dev>"
 *
 * ⚠️ Avec l'expéditeur de test onboarding@resend.dev, Resend ne délivre
 * qu'à l'adresse propriétaire du compte. Pour envoyer à n'importe quel
 * manager, il faut un domaine vérifié dans Resend + RESEND_FROM dessus.
 */
export async function sendEmail(
  to: string,
  message: NotificationMessage,
): Promise<ChannelResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "PORTTRACK <onboarding@resend.dev>";

  if (!apiKey) {
    return { channel: "email", ok: false, skipped: true, error: "RESEND_API_KEY manquant" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: message.subject,
        html: message.htmlBody ?? `<pre>${escapeHtml(message.textBody)}</pre>`,
        text: message.textBody,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        channel: "email",
        ok: false,
        error: `Resend ${res.status}: ${detail.slice(0, 200)}`,
      };
    }
    return { channel: "email", ok: true };
  } catch (e: unknown) {
    return {
      channel: "email",
      ok: false,
      error: e instanceof Error ? e.message : "Erreur réseau Resend",
    };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
