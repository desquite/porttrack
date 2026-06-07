import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Anchor, AlertTriangle, LogOut } from "lucide-react";

import { isTenantBlocked, type TenantStatut } from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/[locale]/(app)/actions";

/**
 * Écran de blocage : compte suspendu / résilié / essai expiré (V7 §15.3).
 * Le layout (app) redirige ici les utilisateurs d'un tenant bloqué. Cette page
 * vit HORS du groupe (app) pour éviter une boucle de redirection.
 */
export default async function CompteSuspenduPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user!.id)
    .maybeSingle();

  // SUPER_ADMIN n'est jamais bloqué → renvoyé vers le dashboard.
  if (profile?.role === "SUPER_ADMIN") redirect(`/${locale}/dashboard`);

  let statut: TenantStatut | null = null;
  let dateFinEssai: string | null = null;
  let tenantName: string | null = null;
  let emailContact: string | null = null;
  if (profile?.tenant_id) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("nom_entreprise, statut, date_fin_essai, email_manager")
      .eq("id", profile.tenant_id)
      .maybeSingle();
    statut = (tenant?.statut ?? null) as TenantStatut | null;
    dateFinEssai = tenant?.date_fin_essai ?? null;
    tenantName = tenant?.nom_entreprise ?? null;
    emailContact = tenant?.email_manager ?? null;
  }

  // Si le compte n'est PAS bloqué, cette page n'a pas lieu d'être → dashboard.
  if (!isTenantBlocked(statut, dateFinEssai)) {
    redirect(`/${locale}/dashboard`);
  }

  const { title, message } =
    statut === "CANCELLED"
      ? {
          title: "Abonnement résilié",
          message: "L'abonnement de votre entreprise a été résilié. Pour réactiver votre accès, contactez l'équipe PORTTRACK.",
        }
      : statut === "SUSPENDED"
        ? {
            title: "Compte suspendu",
            message: "L'accès de votre entreprise est temporairement suspendu. Pour le rétablir, contactez l'équipe PORTTRACK.",
          }
        : {
            title: "Période d'essai terminée",
            message: "Votre période d'essai gratuite est arrivée à échéance. Pour continuer à utiliser PORTTRACK, contactez l'équipe pour activer votre abonnement.",
          };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md rounded-xl border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <AlertTriangle className="size-6" />
        </div>

        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {tenantName && (
          <p className="mt-1 text-sm text-muted-foreground">{tenantName}</p>
        )}

        <p className="mt-4 text-sm text-muted-foreground">{message}</p>

        <div className="mt-6 rounded-lg bg-muted/50 p-4 text-sm">
          <p className="font-medium text-foreground">Contact PORTTRACK</p>
          <p className="mt-1 text-muted-foreground">
            Écrivez-nous pour réactiver votre accès
            {emailContact ? <> (compte : {emailContact})</> : null}.
          </p>
        </div>

        <form action={signOutAction} className="mt-6">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent"
          >
            <LogOut className="size-4" />
            Se déconnecter
          </button>
        </form>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Anchor className="size-3.5" />
          PORTTRACK
        </div>
      </div>
    </main>
  );
}
