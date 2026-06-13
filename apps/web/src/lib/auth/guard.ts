import { redirect } from "next/navigation";
import {
  canAccess,
  firstAllowedHref,
  parsePermissions,
  type Role,
} from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";

/**
 * Garde serveur d'accès à un sous-droit. À appeler en tête d'un
 * layout de module — protège la page ET toutes ses sous-routes, même en accès
 * direct par URL (le menu masqué ne suffit pas).
 *
 * Manager/Super Admin passent toujours (canAccess renvoie true). Un utilisateur
 * sans le droit est redirigé vers sa 1re page autorisée.
 */
export async function requireAccess(key: string, locale: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: me } = await supabase
    .from("users")
    .select("role, permissions")
    .eq("id", user!.id)
    .maybeSingle();

  const role = (me?.role ?? "CUSTOM") as Role;
  const perms = parsePermissions(me?.permissions);

  if (!canAccess(role, perms, key)) {
    redirect(`/${locale}${firstAllowedHref(role, perms)}`);
  }
}
