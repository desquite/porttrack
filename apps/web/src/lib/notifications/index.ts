import type {
  ChannelResult,
  NotificationMessage,
  NotificationRecipient,
} from "./types";
import { sendEmail } from "./email-resend";
import { sendWhatsapp } from "./whatsapp-wasender";

export type { NotificationMessage, NotificationRecipient, ChannelResult };

/**
 * Envoie un message sur TOUS les canaux dont le destinataire dispose.
 * Les canaux sont indépendants : si l'email échoue, WhatsApp est quand
 * même tenté, et vice-versa. Retourne le résultat par canal pour le log.
 *
 * Le texte WhatsApp = subject + textBody concaténés (WhatsApp n'a pas
 * de notion de sujet séparé).
 */
export async function notify(
  recipient: NotificationRecipient,
  message: NotificationMessage,
): Promise<ChannelResult[]> {
  const tasks: Promise<ChannelResult>[] = [];

  if (recipient.email) {
    tasks.push(sendEmail(recipient.email, message));
  }
  if (recipient.phone) {
    const waText = `*${message.subject}*\n\n${message.textBody}`;
    tasks.push(sendWhatsapp(recipient.phone, waText));
  }

  if (tasks.length === 0) {
    return [
      { channel: "email", ok: false, skipped: true, error: "Aucun email" },
      { channel: "whatsapp", ok: false, skipped: true, error: "Aucun téléphone" },
    ];
  }

  return Promise.all(tasks);
}
