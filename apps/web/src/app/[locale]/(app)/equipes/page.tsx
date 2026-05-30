import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { CalendarClock, Plus, CheckCircle2, Clock } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { WEEKDAYS } from "@porttrack/shared";

export default async function EquipesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ created?: string; deleted?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: equipes } = await supabase
    .from("equipes")
    .select("*")
    .order("ordre", { ascending: true })
    .order("nom", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Équipes & rotations</h1>
          <p className="text-sm text-muted-foreground">
            Configure tes équipes de chauffeurs (Jour, Nuit, Repos…). Chaque équipe a son code, ses horaires, ses jours travaillés et sa couleur.
          </p>
        </div>
        <Button asChild>
          <Link href="/equipes/new"><Plus className="mr-2 size-4" />Nouvelle équipe</Link>
        </Button>
      </div>

      {sp.created && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900">
          <CheckCircle2 className="size-4" /><AlertTitle>Équipe créée</AlertTitle>
        </Alert>
      )}
      {sp.deleted && (
        <Alert className="border-rose-200 bg-rose-50/60 text-rose-900">
          <CheckCircle2 className="size-4" /><AlertTitle>Équipe supprimée</AlertTitle>
          <AlertDescription>Les chauffeurs rattachés ont perdu cette équipe par défaut.</AlertDescription>
        </Alert>
      )}

      {!equipes || equipes.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <CalendarClock className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">Aucune équipe</CardTitle>
            <CardDescription>Commence par créer une équipe Jour, Nuit ou Repos.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {equipes.map((e) => <EquipeCard key={e.id} equipe={e} />)}
        </div>
      )}
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function EquipeCard({ equipe: e }: { equipe: any }) {
  const jours = (e.jours_travailles as number[]) ?? [];
  const joursLabel = jours.length === 7
    ? "Tous les jours"
    : jours.length === 0
      ? "Aucun jour"
      : WEEKDAYS.filter((d) => jours.includes(d.value)).map((d) => d.label).join(", ");
  const horaire = e.heure_debut && e.heure_fin
    ? `${String(e.heure_debut).slice(0, 5)} – ${String(e.heure_fin).slice(0, 5)}`
    : "—";

  return (
    <Card className={"transition-colors hover:border-primary/40 " + (e.actif ? "" : "opacity-60")}>
      <CardContent className="p-4">
        <Link href={`/equipes/${e.id}`} className="block space-y-3">
          <div className="flex items-center gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white"
              style={{ backgroundColor: e.couleur ?? "#3b82f6" }}
            >
              {e.code}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium truncate">{e.nom}</span>
                {!e.actif && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="size-3" />
                {horaire}
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">{joursLabel}</div>
        </Link>
      </CardContent>
    </Card>
  );
}
