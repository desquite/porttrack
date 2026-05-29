import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, Wrench } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PanneForm } from "../_components/panne-form";
import { loadMaterielsForPanne } from "../_components/load-materiels";

export default async function NewPannePage({
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user!.id)
    .maybeSingle();

  const tenantId = profile?.tenant_id ?? null;
  const materiels = await loadMaterielsForPanne();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/pannes" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" />
          Retour à la liste
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Wrench className="size-6 text-primary" />
          Déclarer une panne
        </h1>
        <p className="text-sm text-muted-foreground">
          Le matériel passera automatiquement en « En panne » et ne sera plus
          sélectionnable dans les listes d&apos;affectation jusqu&apos;à la clôture.
        </p>
      </div>

      {!tenantId ? (
        <Alert variant="destructive">
          <AlertTitle>Création impossible</AlertTitle>
          <AlertDescription>
            Ton compte n&apos;est rattaché à aucune entreprise. Contacte ton manager.
          </AlertDescription>
        </Alert>
      ) : materiels.length === 0 ? (
        <Alert>
          <AlertTitle>Aucun matériel</AlertTitle>
          <AlertDescription>
            Il faut d&apos;abord enregistrer du matériel roulant (Flotte → Nouveau matériel).
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détails de la panne</CardTitle>
            <CardDescription>
              Les champs marqués d&apos;une <span className="text-rose-600">*</span> sont obligatoires.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PanneForm
              mode="create"
              tenantId={tenantId}
              materiels={materiels}
              defaultValues={sp.materiel ? { materiel_roulant_id: sp.materiel } : undefined}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
