import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, CalendarOff, CheckCircle2, XCircle } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AbsenceForm } from "../_components/absence-form";
import { loadChauffeurs } from "../_components/load-chauffeurs";
import { DeleteAbsenceButton } from "../_components/delete-absence-button";

export default async function AbsenceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ created?: string; updated?: string; error?: string }>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: absence } = await supabase.from("absences").select("*").eq("id", id).maybeSingle();
  if (!absence) notFound();

  const chauffeurs = await loadChauffeurs();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/absences" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" />Retour aux absences
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <CalendarOff className="size-6 text-primary" />Absence
        </h1>
      </div>

      {sp.created && <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>Absence enregistrée</AlertTitle></Alert>}
      {sp.updated && <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>Mise à jour enregistrée</AlertTitle></Alert>}
      {sp.error && <Alert variant="destructive"><XCircle className="size-4" /><AlertTitle>Erreur</AlertTitle><AlertDescription>{sp.error}</AlertDescription></Alert>}

      <Card>
        <CardHeader><CardTitle className="text-base">Détails</CardTitle></CardHeader>
        <CardContent>
          <AbsenceForm
            mode="update"
            absenceId={absence.id}
            tenantId={absence.tenant_id}
            chauffeurs={chauffeurs}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            defaultValues={absence as any}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <DeleteAbsenceButton absenceId={absence.id} />
      </div>
    </div>
  );
}
