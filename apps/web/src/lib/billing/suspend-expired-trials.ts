import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@porttrack/shared";

type Admin = SupabaseClient<Database>;

/**
 * Bascule en SUSPENDED tous les tenants dont l'essai (TRIAL) a expiré
 * (date_fin_essai dépassée). Idempotent : ne touche que les TRIAL expirés.
 *
 * Note : l'accès est de toute façon bloqué dès l'expiration côté layout
 * (isTenantBlocked), même avant ce passage du cron. Ce cron sert à refléter
 * proprement le statut en base (reporting, cohérence).
 */
export async function suspendExpiredTrials(admin: Admin): Promise<{
  suspended: number;
  ids: string[];
}> {
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await admin
    .from("tenants")
    .update({ statut: "SUSPENDED" })
    .eq("statut", "TRIAL")
    .not("date_fin_essai", "is", null)
    .lt("date_fin_essai", today)
    .select("id");

  if (error) throw new Error(error.message);
  return { suspended: data?.length ?? 0, ids: (data ?? []).map((t) => t.id) };
}
