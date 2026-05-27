/**
 * Helpers pour afficher les dates d'expiration des documents (permis, visite
 * médicale, assurance, etc.) avec un code couleur cohérent dans toute l'UI.
 */

export type ExpiryStatus = "expired" | "soon" | "ok" | "unknown";

/**
 * Classe une date d'expiration selon trois seuils :
 *   - expired : date passée (déjà dépassée)
 *   - soon    : expire dans les <= warningDays jours (défaut 30)
 *   - ok      : expire plus tard
 *   - unknown : pas de date renseignée
 */
export function classifyExpiry(
  dateIso: string | null | undefined,
  warningDays = 30,
): ExpiryStatus {
  if (!dateIso) return "unknown";
  const exp = new Date(dateIso);
  if (Number.isNaN(exp.getTime())) return "unknown";
  const now = new Date();
  const diffMs = exp.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "expired";
  if (diffDays <= warningDays) return "soon";
  return "ok";
}

/**
 * Variante de Badge à utiliser selon le statut d'expiration.
 * (Aligné avec les variantes du composant Badge.)
 */
export const EXPIRY_BADGE_VARIANT: Record<
  ExpiryStatus,
  "success" | "warning" | "danger" | "outline"
> = {
  ok: "success",
  soon: "warning",
  expired: "danger",
  unknown: "outline",
};

/**
 * Libellé court FR pour l'expiration (affiché à côté de la date).
 */
export function formatExpiryLabel(
  dateIso: string | null | undefined,
): string {
  if (!dateIso) return "Non renseigné";
  const exp = new Date(dateIso);
  if (Number.isNaN(exp.getTime())) return "Date invalide";
  const now = new Date();
  const diffMs = exp.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `Expiré depuis ${Math.abs(diffDays)}j`;
  if (diffDays === 0) return "Expire aujourd'hui";
  if (diffDays === 1) return "Expire demain";
  if (diffDays <= 30) return `Expire dans ${diffDays}j`;
  return `Expire dans ${diffDays}j`;
}

/**
 * Format date au format FR court (JJ/MM/AAAA) pour les tableaux.
 */
export function formatDateFR(dateIso: string | null | undefined): string {
  if (!dateIso) return "—";
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
