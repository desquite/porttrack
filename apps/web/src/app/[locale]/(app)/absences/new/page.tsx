import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, CalendarOff } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AbsenceForm } from "../_components/absence-form";
import { loadChauffeurs } from "../_components/load-chauffeurs";

export default async function NewAbsencePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ chauffeur?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("users").select("tenant_id").eq("id", user!.id).maybeSingle();
  const tenantId = profile?.tenant_id ?? null;
  const chauffeurs = await loadChauffeurs();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/absences" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" />Retour aux absences
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <CalendarOff className="size-6 text-primary" />Enregistrer une absence
        </h1>
      </div>

      {!tenantId ? (
        <Alert variant="destructive"><AlertTitle>Création impossible</AlertTitle><AlertDescription>Ton compte n&apos;est rattaché à aucune entreprise.</AlertDescription></Alert>
      ) : chauffeurs.length === 0 ? (
        <Alert><AlertTitle>Aucun chauffeur</AlertTitle><AlertDescription>Enregistre d&apos;abord un chauffeur.</AlertDescription></Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détails</CardTitle>
            <CardDescription>Les champs marqués <span className="text-rose-600">*</span> sont obligatoires.</CardDescription>
          </CardHeader>
          <CardContent>
            <AbsenceForm
              mode="create"
              tenantId={tenantId}
              chauffeurs={chauffeurs}
              defaultValues={sp.chauffeur ? { chauffeur_id: sp.chauffeur } : undefined}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
