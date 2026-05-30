import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, Megaphone } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DesignationForm } from "../_components/designation-form";
import { loadDesignationRefs } from "../_components/load-refs";

export default async function NewDesignationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; chauffeur?: string; materiel?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("users").select("tenant_id").eq("id", user!.id).maybeSingle();
  const tenantId = profile?.tenant_id ?? null;

  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : new Date().toISOString().slice(0, 10);
  const refs = await loadDesignationRefs(date);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href={`/designations?date=${date}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" />Retour à la liste
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Megaphone className="size-6 text-primary" />Désigner un chauffeur
        </h1>
        <p className="text-sm text-muted-foreground">
          Sélectionne le chauffeur et son matériel pour la journée. Un WhatsApp lui est envoyé automatiquement.
        </p>
      </div>

      {!tenantId ? (
        <Alert variant="destructive">
          <AlertTitle>Désignation impossible</AlertTitle>
          <AlertDescription>Ton compte n&apos;est rattaché à aucune entreprise.</AlertDescription>
        </Alert>
      ) : refs.chauffeurs.length === 0 ? (
        <Alert>
          <AlertTitle>Aucun chauffeur disponible</AlertTitle>
          <AlertDescription>
            Aucun chauffeur actif et non absent le {date}. Vérifie la liste des chauffeurs et des absences.
          </AlertDescription>
        </Alert>
      ) : refs.materiels.length === 0 ? (
        <Alert>
          <AlertTitle>Aucun matériel disponible</AlertTitle>
          <AlertDescription>
            Aucun matériel en service. Les matériels en panne, indisponibles ou hors service sont exclus.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détails de la désignation</CardTitle>
            <CardDescription>Les champs marqués <span className="text-rose-600">*</span> sont obligatoires.</CardDescription>
          </CardHeader>
          <CardContent>
            <DesignationForm
              tenantId={tenantId}
              chauffeurs={refs.chauffeurs}
              materiels={refs.materiels}
              defaultDate={date}
              defaultChauffeur={sp.chauffeur}
              defaultMateriel={sp.materiel}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
