"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RoulementSaveResult = { ok: true } | { ok: false; error: string };

/** Enregistre (ou met à jour) le réglage du roulement pour le tenant courant. */
export async function saveRoulementConfigAction(
  dateReference: string,
  equipeJourId: string,
  equipeNuitId: string,
  equipeReposId: string,
): Promise<RoulementSaveResult> {
  if (!dateReference || !/^\d{4}-\d{2}-\d{2}$/.test(dateReference)) {
    return { ok: false, error: "Date de référence invalide." };
  }
  if (!equipeJourId || !equipeNuitId || !equipeReposId) {
    return { ok: false, error: "Choisis une équipe pour chacun des trois postes." };
  }
  if (
    equipeJourId === equipeNuitId ||
    equipeJourId === equipeReposId ||
    equipeNuitId === equipeReposId
  ) {
    return { ok: false, error: "Les trois équipes doivent être différentes (jour, nuit, repos)." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .maybeSingle();
  const tenantId = profile?.tenant_id;
  if (!tenantId) return { ok: false, error: "Aucune entreprise rattachée à ton compte." };
  if (profile?.role !== "MANAGER" && profile?.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Réservé au manager." };
  }

  const { error } = await supabase
    .from("roulement_config")
    .upsert(
      {
        tenant_id: tenantId,
        date_reference: dateReference,
        equipe_jour_id: equipeJourId,
        equipe_nuit_id: equipeNuitId,
        equipe_repos_id: equipeReposId,
        updated_by: user.id,
      },
      { onConflict: "tenant_id" },
    );

  if (error) {
    if (error.code === "42501" || error.message.includes("row-level security")) {
      return { ok: false, error: "Tu n'as pas les droits pour cette opération." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/parametres/roulement");
  revalidatePath("/planning");
  revalidatePath("/designations");
  return { ok: true };
}
