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
import { MaterielForm } from "../_components/materiel-form";
import { DeleteMaterielButton } from "../_components/delete-materiel-button";

export default async function EditMaterielPage({
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

  // 1. Charge le matériel — RLS auto
  const { data: materiel } = await supabase
    .from("materiel_roulant")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!materiel) {
    notFound();
  }

  // 2. Profil → droits
  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user!.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "SUPER_ADMIN";
  const canDelete = isSuperAdmin || profile?.role === "MANAGER";

  // 3. Nom du tenant pour l'affichage en sous-titre
  let tenantName: string | null = null;
  if (materiel.tenant_id) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("nom_entreprise")
      .eq("id", materiel.tenant_id)
      .maybeSingle();
    tenantName = tenant?.nom_entreprise ?? null;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb + titre */}
      <div className="space-y-1">
        <Link
          href="/flotte"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Retour à la flotte
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="font-mono">{materiel.immatriculation}</span>
          {materiel.marque || materiel.modele ? (
            <span className="ml-2 text-base font-normal text-muted-foreground">
              — {materiel.marque ?? ""} {materiel.modele ?? ""}
            </span>
          ) : null}
        </h1>
        <p className="text-sm text-muted-foreground">
          {tenantName ? <>Entreprise : <strong>{tenantName}</strong> · </> : null}
          Édite les informations du véhicule. Les modifications de dates documents
          mettent à jour les alertes du dashboard.
        </p>
      </div>

      {/* Flash de confirmation après update */}
      {updated && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Modifications enregistrées</AlertTitle>
          <AlertDescription>
            Le véhicule <strong className="font-mono">{updated}</strong> a été mis à jour.
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

      {/* Formulaire */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations véhicule</CardTitle>
          <CardDescription>
            Le tenant est verrouillé en édition. Pour réaffecter le véhicule,
            supprime-le et recrée-le sous l'autre entreprise.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MaterielForm
            mode="update"
            materielId={materiel.id}
            isSuperAdmin={isSuperAdmin}
            tenants={[]}
            defaultTenantId={materiel.tenant_id}
            defaultValues={materiel}
          />
        </CardContent>
      </Card>

      {/* Zone de danger */}
      {canDelete && (
        <Card className="border-rose-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-rose-700">
              <ShieldAlert className="size-4" />
              Zone de danger
            </CardTitle>
            <CardDescription>
              La suppression est définitive. Les affectations passées et les
              documents associés à ce véhicule perdront leur référence
              (champ owner_id orphelin dans documents).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteMaterielButton
              materielId={materiel.id}
              materielLabel={`${materiel.immatriculation} — ${materiel.marque ?? ""} ${materiel.modele ?? ""}`.trim()}
            />
          </CardContent>
        </Card>
      )}

      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/flotte">
            <ArrowLeft className="mr-2 size-4" />
            Revenir à la flotte
          </Link>
        </Button>
      </div>
    </div>
  );
}
