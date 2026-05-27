import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChauffeurForm } from "../_components/chauffeur-form";
import { DeleteChauffeurButton } from "../_components/delete-chauffeur-button";

export default async function EditChauffeurPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const { locale, id } = await params;
  const { updated, error } = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Charge le chauffeur — la RLS bloque si pas le droit
  const { data: chauffeur } = await supabase
    .from("chauffeurs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!chauffeur) {
    // Soit l'id n'existe pas, soit la RLS filtre → 404 dans les 2 cas
    notFound();
  }

  // 2. Charge le profil pour décider de l'affichage (rôle)
  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user!.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "SUPER_ADMIN";
  const canDelete = isSuperAdmin || profile?.role === "MANAGER";

  // 3. Si SUPER_ADMIN, charge la liste des tenants (utile pour le nom affiché)
  let tenantName: string | null = null;
  if (chauffeur.tenant_id) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("nom_entreprise")
      .eq("id", chauffeur.tenant_id)
      .maybeSingle();
    tenantName = tenant?.nom_entreprise ?? null;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb + titre */}
      <div className="space-y-1">
        <Link
          href="/chauffeurs"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Retour à la liste
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          {chauffeur.prenoms} {chauffeur.nom}
        </h1>
        <p className="text-sm text-muted-foreground">
          {tenantName ? <>Entreprise : <strong>{tenantName}</strong> · </> : null}
          Édite les informations puis enregistre. Les modifications de dates
          mettent à jour les alertes du dashboard.
        </p>
      </div>

      {/* Flash de confirmation après update */}
      {updated && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Modifications enregistrées</AlertTitle>
          <AlertDescription>
            Les informations de <strong>{updated}</strong> ont été mises à jour.
          </AlertDescription>
        </Alert>
      )}

      {/* Erreur de suppression remontée par l'URL */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Formulaire d'édition */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations chauffeur</CardTitle>
          <CardDescription>
            Le tenant est verrouillé en édition. Pour réaffecter le chauffeur,
            supprime-le et recrée-le sous l'autre entreprise.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChauffeurForm
            mode="update"
            chauffeurId={chauffeur.id}
            isSuperAdmin={isSuperAdmin}
            tenants={[]}
            defaultTenantId={chauffeur.tenant_id}
            defaultValues={chauffeur}
          />
        </CardContent>
      </Card>

      {/* Zone de danger — visible seulement si le user peut supprimer */}
      {canDelete && (
        <Card className="border-rose-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-rose-700">
              <ShieldAlert className="size-4" />
              Zone de danger
            </CardTitle>
            <CardDescription>
              La suppression est définitive. Les affectations passées et les
              documents associés à ce chauffeur perdront leur référence
              (champ owner_id orphelin dans documents).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteChauffeurButton
              chauffeurId={chauffeur.id}
              chauffeurName={`${chauffeur.prenoms} ${chauffeur.nom}`}
            />
          </CardContent>
        </Card>
      )}

      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/chauffeurs">
            <ArrowLeft className="mr-2 size-4" />
            Revenir à la liste
          </Link>
        </Button>
      </div>
    </div>
  );
}
