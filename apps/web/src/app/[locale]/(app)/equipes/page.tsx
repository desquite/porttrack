import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { CalendarClock, Plus, CheckCircle2, Settings2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  posteForEquipe,
  isRoulementConfigValide,
  ROULEMENT_POSTE_CODE,
  ROULEMENT_POSTE_LABEL,
  ROULEMENT_POSTE_HORAIRES,
  type RoulementConfig,
  type RoulementPoste,
} from "@porttrack/shared";

const POSTE_BG: Record<RoulementPoste, string> = { JOUR: "#bfdbfe", NUIT: "#1e293b", REPOS: "#f1f5f9" };
const POSTE_FG: Record<RoulementPoste, string> = { JOUR: "#1e3a8a", NUIT: "#ffffff", REPOS: "#64748b" };

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
  const [{ data: equipes }, { data: configRow }] = await Promise.all([
    supabase
      .from("equipes")
      .select("*")
      .order("ordre", { ascending: true })
      .order("nom", { ascending: true }),
    supabase
      .from("roulement_config")
      .select("date_reference, equipe_jour_id, equipe_nuit_id, equipe_repos_id")
      .maybeSingle(),
  ]);

  const config: RoulementConfig | null = configRow
    ? {
        dateReference: configRow.date_reference,
        equipeJourId: configRow.equipe_jour_id,
        equipeNuitId: configRow.equipe_nuit_id,
        equipeReposId: configRow.equipe_repos_id,
      }
    : null;
  const roulementActif = isRoulementConfigValide(config);
  const todayIso = new Date().toISOString().slice(0, 10);
  const posteToday = (equipeId: string): RoulementPoste | null =>
    roulementActif ? posteForEquipe(config!, equipeId, todayIso) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Équipes de chauffeurs</h1>
          <p className="text-sm text-muted-foreground">
            Les équipes (A, B, C…) tournent automatiquement entre jour, nuit et repos selon le roulement.
            Définis qui démarre sur quel poste dans{" "}
            <Link href="/parametres/roulement" className="underline">Régler le roulement</Link>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/parametres/roulement"><Settings2 className="mr-1 size-4" />Roulement</Link>
          </Button>
          <Button asChild>
            <Link href="/equipes/new"><Plus className="mr-2 size-4" />Nouvelle équipe</Link>
          </Button>
        </div>
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
            <CardDescription>Crée tes équipes (A, B, C), puis règle le roulement.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {equipes.map((e) => <EquipeCard key={e.id} equipe={e} posteToday={posteToday(e.id)} />)}
        </div>
      )}
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function EquipeCard({ equipe: e, posteToday }: { equipe: any; posteToday: RoulementPoste | null }) {
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
              <div className="mt-0.5 text-xs text-muted-foreground">
                {posteToday ? (
                  <span className="inline-flex items-center gap-1">
                    Aujourd&apos;hui :
                    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: POSTE_BG[posteToday], color: POSTE_FG[posteToday] }}>
                      {ROULEMENT_POSTE_CODE[posteToday]} {ROULEMENT_POSTE_LABEL[posteToday]}
                    </span>
                    {ROULEMENT_POSTE_HORAIRES[posteToday] && <span>{ROULEMENT_POSTE_HORAIRES[posteToday]}</span>}
                  </span>
                ) : (
                  <span className="italic">Roulement non réglé</span>
                )}
              </div>
            </div>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
