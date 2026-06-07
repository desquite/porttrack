import { redirect } from "next/navigation";
import {
  type PlanAbonnement,
  type PlanFeature,
  planAllowsFeature,
} from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";

/**
 * Plan d'abonnement du tenant de l'utilisateur courant.
 *
 * Renvoie `{ plan, tenantId }`. Pour un SUPER_ADMIN (sans tenant) → plan = null
 * = aucune restriction de plan. Sert aux quotas et au gating de fonctionnalités.
 */
export async function getCurrentTenantPlan(): Promise<{
  plan: PlanAbonnement | null;
  tenantId: string | null;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { plan: null, tenantId: null };

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  const tenantId = profile?.tenant_id ?? null;
  if (!tenantId) return { plan: null, tenantId: null };

  const { data: tenant } = await supabase
    .from("tenants")
    .select("plan")
    .eq("id", tenantId)
    .maybeSingle();

  return { plan: (tenant?.plan ?? null) as PlanAbonnement | null, tenantId };
}

/**
 * Garde serveur : exige que le plan du tenant débloque une fonctionnalité.
 * À appeler en tête d'un layout de module (protège page + sous-routes, même en
 * accès direct par URL). Un plan insuffisant est redirigé vers /parametres avec
 * un message d'upsell.
 */
export async function requirePlanFeature(feature: PlanFeature, locale: string): Promise<void> {
  const { plan } = await getCurrentTenantPlan();
  if (!planAllowsFeature(plan, feature)) {
    redirect(`/${locale}/parametres?plan_feature=${feature}`);
  }
}
