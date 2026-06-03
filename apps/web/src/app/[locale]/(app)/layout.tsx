import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { parsePermissions } from "@porttrack/shared";

import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

/**
 * Layout authentifié pour toutes les pages métier (dashboard, chauffeurs,
 * flotte, etc.).
 *
 * Côté serveur :
 *   1. Récupère le user via getUser() — validé contre Supabase
 *   2. Redirige vers /login si pas de session
 *   3. Charge le profil métier (tenant_id, role) et le nom du tenant
 *   4. Délègue le rendu visuel à <AppShell> (composant client)
 *
 * Le middleware fait déjà une première barrière auth pour les routes
 * sensibles, mais on duplique ici en défense en profondeur.
 */
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Récupère le profil métier (RLS laisse l'utilisateur lire sa propre ligne)
  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id, nom, prenoms, permissions")
    .eq("id", user.id)
    .maybeSingle();

  // Nom affiché dans l'en-tête : « Prénom Nom » si renseigné, sinon l'email.
  const userName = [profile?.prenoms, profile?.nom].filter(Boolean).join(" ").trim() || null;
  const userPermissions = parsePermissions(profile?.permissions);

  // Si le profil a un tenant_id, on récupère son nom pour l'afficher dans le header.
  // Pour un SUPER_ADMIN tenant_id est null → on n'affiche pas de nom.
  let tenantName: string | null = null;
  if (profile?.tenant_id) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("nom_entreprise")
      .eq("id", profile.tenant_id)
      .maybeSingle();
    tenantName = tenant?.nom_entreprise ?? null;
  }

  return (
    <AppShell
      userEmail={user.email ?? "—"}
      userName={userName}
      userRole={profile?.role ?? "CUSTOM"}
      userPermissions={userPermissions}
      tenantName={tenantName}
    >
      {children}
    </AppShell>
  );
}
