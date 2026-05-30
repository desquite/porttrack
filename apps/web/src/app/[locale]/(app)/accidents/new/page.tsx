import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, ShieldAlert } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AccidentForm } from "../_components/accident-form";
import { loadAccidentRefs } from "../_components/load-refs";

export default async function NewAccidentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ materiel?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("users").select("tenant_id").eq("id", user!.id).maybeSingle();
  const tenantId = profile?.tenant_id ?? null;
  const refs = await loadAccidentRefs();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/accidents" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" />Retour à la liste
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldAlert className="size-6 text-rose-600" />Déclarer un accident
        </h1>
        <p className="text-sm text-muted-foreground">
          À la déclaration, le matériel passe automatiquement en <strong>Indisponible</strong> et un
          Ordre de Réparation est créé dans le module Pannes.
        </p>
      </div>

      {!tenantId ? (
        <Alert variant="destructive">
          <AlertTitle>Déclaration impossible</AlertTitle>
          <AlertDescription>Ton compte n&apos;est rattaché à aucune entreprise.</AlertDescription>
        </Alert>
      ) : refs.materiels.length === 0 ? (
        <Alert>
          <AlertTitle>Aucun matériel</AlertTitle>
          <AlertDescription>Enregistre d&apos;abord du matériel roulant.</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détails de l&apos;accident</CardTitle>
            <CardDescription>Les champs marqués <span className="text-rose-600">*</span> sont obligatoires.</CardDescription>
          </CardHeader>
          <CardContent>
            <AccidentForm
              mode="create"
              tenantId={tenantId}
              materiels={refs.materiels}
              chauffeurs={refs.chauffeurs}
              defaultValues={sp.materiel ? { materiel_roulant_id: sp.materiel } : undefined}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
