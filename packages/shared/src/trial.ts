// =============================================================================
// Période d'essai & suspension (V7)
// =============================================================================
// Un tenant démarre en statut TRIAL avec une date de fin d'essai. À l'échéance,
// le compte est suspendu (accès bloqué). Helpers purs partagés serveur/client.
// =============================================================================

import type { TenantStatut } from "./constants";

/** Durée de l'essai gratuit, en jours (décision client : 1 mois). */
export const TRIAL_DURATION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Date de fin d'essai = date de création + durée d'essai. Renvoie ISO (date). */
export function computeTrialEnd(createdAt: Date | string = new Date()): string {
  const base = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const end = new Date(base.getTime() + TRIAL_DURATION_DAYS * DAY_MS);
  return end.toISOString().slice(0, 10);
}

/**
 * Jours restants avant la fin d'essai (négatif si dépassé), ou null si pas de
 * date. Calcul en jours calendaires (arrondi au jour près, vers le haut).
 */
export function trialDaysRemaining(
  dateFinEssai: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!dateFinEssai) return null;
  const end = new Date(dateFinEssai);
  if (Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - now.getTime()) / DAY_MS);
}

/** L'essai est-il expiré ? (date de fin dépassée) */
export function isTrialExpired(
  dateFinEssai: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!dateFinEssai) return false;
  const end = new Date(dateFinEssai);
  if (Number.isNaN(end.getTime())) return false;
  return now.getTime() > end.getTime();
}

/**
 * Le tenant doit-il être BLOQUÉ (accès interdit) ?
 *   - SUSPENDED / CANCELLED → bloqué
 *   - TRIAL dont l'essai est expiré → bloqué (immédiat, sans attendre le cron)
 *   - ACTIVE / TRIAL en cours → autorisé
 * Le SUPER_ADMIN n'est jamais soumis à cette règle (géré côté appelant).
 */
export function isTenantBlocked(
  statut: TenantStatut | null | undefined,
  dateFinEssai: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (statut === "SUSPENDED" || statut === "CANCELLED") return true;
  if (statut === "TRIAL" && isTrialExpired(dateFinEssai, now)) return true;
  return false;
}
