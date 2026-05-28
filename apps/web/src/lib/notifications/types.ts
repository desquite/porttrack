/**
 * Abstraction multi-canal pour l'envoi de notifications PORTTRACK.
 *
 * Un message est composé une fois, puis envoyé sur tous les canaux dont le
 * destinataire dispose (email et/ou WhatsApp). Ajouter un canal (SMS, push…)
 * = implémenter une nouvelle fonction d'envoi + l'appeler dans notify().
 */

export type NotificationMessage = {
  /** Sujet (email) / première ligne (WhatsApp) */
  subject: string;
  /** Corps en texte brut — utilisé par WhatsApp et en fallback email */
  textBody: string;
  /** Corps HTML optionnel pour l'email */
  htmlBody?: string;
};

export type NotificationRecipient = {
  email?: string | null;
  phone?: string | null;
};

export type ChannelResult = {
  channel: "email" | "whatsapp";
  ok: boolean;
  skipped?: boolean;
  error?: string;
};
