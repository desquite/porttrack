import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, CalendarClock } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EquipeForm } from "../_components/equipe-form";

export default async function NewEquipePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("users").select("tenant_id").eq("id", user!.id).maybeSingle();
  const tenantId = profile?.tenant_id ?? null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/equipes" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" />Retour aux équipes
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <CalendarClock className="size-6 text-primary" />Nouvelle équipe
        </h1>
      </div>

      {!tenantId ? (
        <Alert variant="destructive">
          <AlertTitle>Création impossible</AlertTitle>
          <AlertDescription>Ton compte n&apos;est rattaché à aucune entreprise.</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
            <CardDescription>Les champs marqués <span className="text-rose-600">*</span> sont obligatoires.</CardDescription>
          </CardHeader>
          <CardContent>
            <EquipeForm mode="create" tenantId={tenantId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
