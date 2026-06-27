"use server";

import { createClient } from "@/lib/supabase/server";
import { loadDriverContext } from "./load-driver";

export type RecordPositionResult = { ok: true } | { ok: false; error: string };

/**
 * Enregistre un point de position du chauffeur connecté (PWA). Insert via la
 * session chauffeur : la RLS vérifie chauffeur_id = current_chauffeur_id() et
 * tenant_id = current_chauffeur_tenant(). Le camion désigné du jour est snapshoté
 * s'il existe (facultatif).
 */
export async function recordPositionAction(
  latitude: number,
  longitude: number,
  accuracyM: number | null,
): Promise<RecordPositionResult> {
  if (
    typeof latitude !== "number" || typeof longitude !== "number" ||
    Number.isNaN(latitude) || Number.isNaN(longitude) ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
  ) {
    return { ok: false, error: "Coordonnées invalides." };
  }

  const { chauffeur, designation } = await loadDriverContext();
  if (!chauffeur) return { ok: false, error: "Session chauffeur introuvable." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const materielId = (designation as any)?.materiel?.id ?? null;

  const supabase = await createClient();
  const { error } = await supabase.from("chauffeur_positions").insert({
    tenant_id: chauffeur.tenant_id,
    chauffeur_id: chauffeur.id,
    materiel_id: materielId,
    latitude,
    longitude,
    accuracy_m: accuracyM,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
