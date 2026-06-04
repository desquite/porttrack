"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Téléchargement d'une pièce GED du camion par le chauffeur.
 * La RLS bloque le chauffeur sur `documents` (pas de tenant dans son JWT) → on
 * passe par le client admin APRÈS avoir vérifié que le document appartient bien
 * au tenant du chauffeur et concerne un matériel.
 */
export async function downloadCamionDocAction(docId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/chauffeur/connexion");

  const { data: chauffeur } = await supabase
    .from("chauffeurs")
    .select("tenant_id")
    .eq("auth_user_id", user!.id)
    .maybeSingle();
  if (!chauffeur) redirect("/chauffeur");

  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("documents")
    .select("fichier_url, fichier_nom, tenant_id, owner_type")
    .eq("id", docId)
    .maybeSingle();

  if (!doc || doc.owner_type !== "MATERIEL" || doc.tenant_id !== chauffeur.tenant_id || !doc.fichier_url) {
    redirect("/chauffeur/camion");
  }

  const { data: signed } = await admin.storage
    .from("documents")
    .createSignedUrl(doc!.fichier_url!, 60, { download: doc!.fichier_nom ?? undefined });
  if (!signed?.signedUrl) redirect("/chauffeur/camion");

  redirect(signed.signedUrl);
}
