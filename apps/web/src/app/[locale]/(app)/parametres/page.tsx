import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Settings,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TenantForm } from "./_components/tenant-form";
import { UsersSection } from "./_components/users-section";

export default async function ParametresPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    tenant?: string;
    updated?: string;
    userMsg?: string;
    userMsgType?: string;
  }>;
}) {
  const { locale } = await params;
  const {
    tenant: tenantIdParam,
    updated,
    userMsg,
    userMsgType,
  } = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Récupère le profil pour connaître le rôle et le tenant_id de l'appelant
  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user!.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "SUPER_ADMIN";

  // Détermine quel tenant on édite :
  //   - MANAGER (ou autre rôle avec tenant_id) → son tenant
  //   - SUPER_ADMIN → ?tenant=xxx, sinon affichage de la liste à choisir
  const tenantIdToEdit = isSuperAdmin
    ? tenantIdParam ?? null
    : profile?.tenant_id ?? null;

  // -------------------------------------------------------------------------
  // Cas A : SUPER_ADMIN sans tenant sélectionné → liste des tenants
  // -------------------------------------------------------------------------
  if (isSuperAdmin && !tenantIdToEdit) {
    const { data: tenants } = await supabase
      .from("tenants")
      .select("id, nom_entreprise, statut, plan, date_creation, telephone, email_manager")
      .order("nom_entreprise", { ascending: true });

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Paramètres — entreprises</h1>
            <p className="text-sm text-muted-foreground">
              En tant que SUPER_ADMIN, sélectionne une entreprise pour éditer ses
              paramètres (informations légales, contact, plan d'abonnement, statut).
            </p>
          </div>
          <Button asChild>
            <Link href="/parametres/nouveau">
              <Plus className="mr-2 size-4" />
              Nouvelle entreprise
            </Link>
          </Button>
        </div>

        {!tenants || tenants.length === 0 ? (
          <Card>
            <CardHeader className="text-center">
              <Building2 className="mx-auto size-8 text-muted-foreground" />
              <CardTitle className="text-base">Aucune entreprise</CardTitle>
              <CardDescription>
                Aucun tenant n'a encore été créé en base.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-3">
            {tenants.map((t) => (
              <Link
                key={t.id}
                href={`/parametres?tenant=${t.id}`}
                className="block"
              >
                <Card className="transition-colors hover:border-primary/30">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Building2 className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{t.nom_entreprise}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {t.plan}
                        </Badge>
                        <Badge
                          variant={
                            t.statut === "ACTIVE"
                              ? "success"
                              : t.statut === "TRIAL"
                                ? "info"
                                : t.statut === "SUSPENDED"
                                  ? "warning"
                                  : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {t.statut}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{t.email_manager}</span>
                        {t.telephone && <span>{t.telephone}</span>}
                        <span>
                          Créé le{" "}
                          {new Date(t.date_creation).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Cas B : pas de tenantId disponible (CUSTOM/USER sans rattachement)
  // -------------------------------------------------------------------------
  if (!tenantIdToEdit) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        </div>
        <Alert variant="destructive">
          <AlertTitle>Aucune entreprise rattachée</AlertTitle>
          <AlertDescription>
            Ton compte n'est rattaché à aucune entreprise. Contacte ton manager
            ou l'équipe PORTTRACK pour t'attribuer une entreprise.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Cas C : on édite un tenant précis
  // -------------------------------------------------------------------------
  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", tenantIdToEdit)
    .maybeSingle();

  if (!tenant) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        </div>
        <Alert variant="destructive">
          <AlertTitle>Entreprise introuvable</AlertTitle>
          <AlertDescription>
            L'entreprise demandée n'existe pas ou tu n'as pas les droits pour y
            accéder.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        {isSuperAdmin && (
          <Link
            href="/parametres"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            ← Toutes les entreprises
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight">
          <Settings className="mr-2 inline size-5 text-primary" />
          {tenant.nom_entreprise}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isSuperAdmin
            ? "Édite tous les paramètres incluant le plan d'abonnement et le statut."
            : "Édite les informations de ton entreprise. Les champs marqués d'une "
              + "★ sont obligatoires."}
        </p>
      </div>

      {/* Flash post-update */}
      {updated && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Modifications enregistrées</AlertTitle>
          <AlertDescription>
            Les paramètres de <strong>{updated}</strong> ont été mis à jour.
          </AlertDescription>
        </Alert>
      )}

      {/* Form profil */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profil de l'entreprise</CardTitle>
          <CardDescription>
            Ces informations apparaissent sur les factures FNE et dans les
            communications avec tes chauffeurs et le PAA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TenantForm tenant={tenant} isSuperAdmin={isSuperAdmin} />
        </CardContent>
      </Card>

      {/* Section Membres */}
      <UsersSection
        tenantId={tenant.id}
        currentUserId={user!.id}
        userMsg={userMsg}
        userMsgType={
          userMsgType === "error" || userMsgType === "success"
            ? userMsgType
            : undefined
        }
      />
    </div>
  );
}
