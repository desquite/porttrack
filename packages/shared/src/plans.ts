// =============================================================================
// Limites des plans d'abonnement (V7)
// =============================================================================
// Source de vérité unique des quotas et du gating de fonctionnalités par plan.
// Utilisée côté serveur (blocage création users/MR, gardes de page, webhook bot)
// ET côté client (masquage du menu, affichage de l'usage).
//
// Les fonctionnalités non listées (import, transport, GED, alertes BADT/docs)
// sont disponibles dans TOUS les plans : on ne référence ici que celles qui
// sont restreintes.
// =============================================================================

import type { PlanAbonnement } from "./constants";

/** Fonctionnalités soumises à restriction de plan. */
export type PlanFeature = "bot_whatsapp" | "planning";

export type PlanLimits = {
  /** Nombre max d'utilisateurs (null = illimité). */
  maxUsers: number | null;
  /** Nombre max de matériel roulant (null = illimité). */
  maxMateriel: number | null;
  /** Fonctionnalités restreintes débloquées par ce plan. */
  features: readonly PlanFeature[];
};

/** Ordre croissant des plans (pour les messages d'upsell). */
export const PLAN_ORDER: readonly PlanAbonnement[] = ["STARTER", "BUSINESS", "PREMIUM"];

export const PLAN_LABELS: Record<PlanAbonnement, string> = {
  STARTER: "Starter",
  BUSINESS: "Business",
  PREMIUM: "Premium",
};

export const PLAN_LIMITS: Record<PlanAbonnement, PlanLimits> = {
  STARTER:  { maxUsers: 5,    maxMateriel: 5,    features: [] },
  BUSINESS: { maxUsers: 15,   maxMateriel: 25,   features: ["bot_whatsapp", "planning"] },
  PREMIUM:  { maxUsers: null, maxMateriel: null, features: ["bot_whatsapp", "planning"] },
};

/**
 * Une fonctionnalité restreinte est-elle autorisée pour ce plan ?
 * `null`/`undefined` (ex. SUPER_ADMIN sans tenant) → aucune restriction.
 */
export function planAllowsFeature(
  plan: PlanAbonnement | null | undefined,
  feature: PlanFeature,
): boolean {
  if (!plan) return true;
  return PLAN_LIMITS[plan].features.includes(feature);
}

/** Limite d'utilisateurs du plan (null = illimité ou pas de plan). */
export function planUserLimit(plan: PlanAbonnement | null | undefined): number | null {
  if (!plan) return null;
  return PLAN_LIMITS[plan].maxUsers;
}

/** Limite de matériel roulant du plan (null = illimité ou pas de plan). */
export function planMaterielLimit(plan: PlanAbonnement | null | undefined): number | null {
  if (!plan) return null;
  return PLAN_LIMITS[plan].maxMateriel;
}

/** Peut-on encore créer un élément ? (count < limit ; limit null = illimité). */
export function isWithinLimit(count: number, limit: number | null): boolean {
  return limit === null || count < limit;
}

/** Plan minimal qui débloque une fonctionnalité (pour message d'upsell). */
export function minPlanForFeature(feature: PlanFeature): PlanAbonnement | null {
  return PLAN_ORDER.find((p) => PLAN_LIMITS[p].features.includes(feature)) ?? null;
}

/** Libellé court d'une fonctionnalité (messages utilisateur). */
export const PLAN_FEATURE_LABELS: Record<PlanFeature, string> = {
  bot_whatsapp: "Bot WhatsApp",
  planning: "Planning chauffeurs",
};
