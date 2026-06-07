import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FluxImporter } from "./_components/flux-importer";

export default async function ImportFluxPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user!.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "SUPER_ADMIN";
  const defaultTenantId: string | null = profile?.tenant_id ?? null;
  let tenants: { id: string; nom_entreprise: string }[] = [];
  let blockerMessage: string | null = null;

  if (isSuperAdmin) {
    const { data } = await supabase
      .from("tenants")
      .select("id, nom_entreprise")
      .order("nom_entreprise", { ascending: true });
    tenants = data ?? [];
    if (tenants.length === 0) {
      blockerMessage = "Aucun tenant n'existe encore en base.";
    }
  } else if (!defaultTenantId) {
    blockerMessage =
      "Ton compte n'est rattaché à aucune entreprise. Contacte ton manager.";
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href="/conteneurs"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Retour à la liste
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <FileSpreadsheet className="size-6 text-primary" />
          Importer un flux Excel
        </h1>
        <p className="text-sm text-muted-foreground">
          Charge le fichier reçu de l&apos;aconier. PORTTRACK
          mappe les colonnes et crée les conteneurs en statut
          « En attente ». Formats acceptés : .xlsx, .xls, .csv.
        </p>
      </div>

      {blockerMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Import impossible</AlertTitle>
          <AlertDescription>{blockerMessage}</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assistant d&apos;import</CardTitle>
            <CardDescription>
              Trois étapes : sélection du fichier, vérification du mapping et aperçu,
              puis rapport d&apos;import.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FluxImporter
              isSuperAdmin={isSuperAdmin}
              tenants={tenants}
              defaultTenantId={defaultTenantId}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
