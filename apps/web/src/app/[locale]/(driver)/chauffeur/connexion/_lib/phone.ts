// Normalisation téléphone partagée entre le formulaire (verifyOtp côté client)
// et la server action (createUser + signInWithOtp côté serveur). Les DEUX
// doivent produire EXACTEMENT le même E.164, sinon Supabase Auth verrait deux
// numéros distincts (compte créé ≠ compte vérifié).

/** Convertit un numéro CI saisi librement en E.164 (+225…). */
export function toE164(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("225")) return "+" + d;
  return "+225" + d.replace(/^0+/, "");
}

/**
 * « Cœur » abonné : 8 derniers chiffres. Sert au matching d'un numéro saisi
 * (formats 8/10 chiffres, avec/sans 0, avec/sans 225) contre les téléphones
 * enregistrés des chauffeurs. Même logique que le bot WhatsApp et le SMS hook.
 */
export function phoneCore(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "").slice(-8);
}
