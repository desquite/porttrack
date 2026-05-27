import { createClient } from "@supabase/supabase-js";
import type { Database } from "@porttrack/shared";

/**
 * Client Supabase avec privilèges service_role — BYPASSE LA RLS.
 *
 * À UTILISER UNIQUEMENT côté serveur (Server Actions, Route Handlers,
 * server scripts). Ne JAMAIS l'instancier côté client (la service_role
 * exposée donnerait un accès admin total à la DB et au Storage).
 *
 * Cas d'usage légitimes dans PORTTRACK :
 *   - Création d'un auth.users via admin.createUser (invitation user)
 *   - Génération de magic link via admin.generateLink
 *   - Tâches d'administration cross-tenant (rapports, support)
 *
 * Les opérations cross-tenant initiées par un MANAGER doivent toujours
 * vérifier les droits AVANT d'utiliser ce client (par exemple : vérifier
 * que le MANAGER est bien le manager du tenant cible).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "createAdminClient: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant",
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
