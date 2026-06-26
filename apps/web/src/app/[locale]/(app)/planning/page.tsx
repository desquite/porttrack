import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { CalendarRange, ChevronLeft, ChevronRight, RotateCcw, Users, Megaphone, Settings2, AlertTriangle } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  posteForEquipe,
  isRoulementConfigValide,
  ROULEMENT_POSTE_CODE,
  ROULEMENT_POSTE_LABEL,
  type RoulementConfig,
  type RoulementPoste,
  type Database,
} from "@porttrack/shared";
import { PrintButton } from "./_components/print-button";

type AbsenceType = Database["public"]["Enums"]["absence_type"];

const POSTE_BG: Record<RoulementPoste, string> = { JOUR: "#bfdbfe", NUIT: "#1e293b", REPOS: "#f1f5f9" };
const POSTE_FG: Record<RoulementPoste, string> = { JOUR: "#1e3a8a", NUIT: "#ffffff", REPOS: "#94a3b8" };

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addMonths(year: number, month0: number, delta: number): { year: number; month0: number } {
  const d = new Date(year, month0 + delta, 1);
  return { year: d.getFullYear(), month0: d.getMonth() };
}

const FR_MONTH_LONG = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const WEEKDAY_LETTER = ["D", "L", "M", "M", "J", "V", "S"]; // index = getDay()

export default async function PlanningPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ mois?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  // Mois cible (?mois=YYYY-MM), sinon mois courant.
  const now = new Date();
  let year = now.getFullYear();
  let month0 = now.getMonth();
  if (sp.mois && /^\d{4}-\d{2}$/.test(sp.mois)) {
    year = Number(sp.mois.slice(0, 4));
    month0 = Number(sp.mois.slice(5, 7)) - 1;
  }
  const monthLabel = FR_MONTH_LONG.format(new Date(year, month0, 1));
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month0, i + 1));
  const startIso = isoDate(days[0]);
  const endIso = isoDate(days[daysInMonth - 1]);
  const todayIso = isoDate(now);

  const prev = addMonths(year, month0, -1);
  const next = addMonths(year, month0, 1);
  const monthParam = (y: number, m0: number) => `${y}-${String(m0 + 1).padStart(2, "0")}`;
  const prevHref = `/planning?mois=${monthParam(prev.year, prev.month0)}`;
  const nextHref = `/planning?mois=${monthParam(next.year, next.month0)}`;

  const supabase = await createClient();

  const [{ data: configRow }, { data: equipesRaw }, { data: chauffeursRaw }, { data: absences }] = await Promise.all([
    supabase
      .from("roulement_config")
      .select("date_reference, equipe_jour_id, equipe_nuit_id, equipe_repos_id")
      .maybeSingle(),
    supabase
      .from("equipes")
      .select("id, nom, code, couleur, actif, ordre")
      .eq("actif", true)
      .order("ordre", { ascending: true }),
    supabase
      .from("chauffeurs")
      .select("id, nom, prenoms, equipe_id_defaut")
      .eq("statut", "ACTIF")
      .order("nom", { ascending: true }),
    supabase
      .from("absences")
      .select("chauffeur_id, type, date_debut, date_fin")
      .lte("date_debut", endIso)
      .gte("date_fin", startIso),
  ]);

  const config: RoulementConfig | null = configRow
    ? {
        dateReference: configRow.date_reference,
        equipeJourId: configRow.equipe_jour_id,
        equipeNuitId: configRow.equipe_nuit_id,
        equipeReposId: configRow.equipe_repos_id,
      }
    : null;
  const configValide = isRoulementConfigValide(config);

  // Absences indexées par chauffeur.
  const absByChauffeur = new Map<string, { type: AbsenceType; date_debut: string; date_fin: string }[]>();
  for (const a of absences ?? []) {
    const arr = absByChauffeur.get(a.chauffeur_id) ?? [];
    arr.push(a);
    absByChauffeur.set(a.chauffeur_id, arr);
  }
  function absenceOn(chauffeurId: string, dateIso: string): AbsenceType | null {
    const hit = (absByChauffeur.get(chauffeurId) ?? []).find((a) => a.date_debut <= dateIso && a.date_fin >= dateIso);
    return hit?.type ?? null;
  }

  const equipes = equipesRaw ?? [];
  // Groupe les chauffeurs par équipe (ceux sans équipe vont dans "Hors roulement").
  const chauffeursByEquipe = new Map<string | null, { id: string; nom: string; prenoms: string }[]>();
  for (const c of chauffeursRaw ?? []) {
    const key = c.equipe_id_defaut ?? null;
    const arr = chauffeursByEquipe.get(key) ?? [];
    arr.push({ id: c.id, nom: c.nom, prenoms: c.prenoms });
    chauffeursByEquipe.set(key, arr);
  }

  // Cellule d'un chauffeur : absence prioritaire, sinon poste du roulement de son équipe.
  function cell(chauffeurId: string, equipeId: string | null, dateIso: string):
    | { kind: "ABS"; code: string; label: string }
    | { kind: "POSTE"; poste: RoulementPoste }
    | null {
    const abs = absenceOn(chauffeurId, dateIso);
    if (abs) {
      const isConge = abs === "CONGE_PLANIFIE";
      return { kind: "ABS", code: isConge ? "Cgé" : "Abs", label: isConge ? "Congé" : "Absent" };
    }
    if (configValide && equipeId) {
      const poste = posteForEquipe(config!, equipeId, dateIso);
      if (poste) return { kind: "POSTE", poste };
    }
    return null;
  }

  const totalChauffeurs = (chauffeursRaw ?? []).length;

  return (
    <div className="space-y-6">
      {/* En-tête + navigation (hors zone d'impression) */}
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <CalendarRange className="size-6 text-primary" />
            Planning mensuel
          </h1>
          <p className="text-sm capitalize text-muted-foreground">{monthLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm"><Link href={prevHref}><ChevronLeft className="size-4" /></Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/planning"><RotateCcw className="mr-1 size-3.5" />Ce mois-ci</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href={nextHref}><ChevronRight className="size-4" /></Link></Button>
          <PrintButton />
          <Button asChild variant="outline" size="sm"><Link href="/parametres/roulement"><Settings2 className="mr-1 size-4" />Régler le roulement</Link></Button>
        </div>
      </div>

      {/* Avertissement si pas de roulement configuré */}
      {!configValide && (
        <Alert className="border-amber-300 bg-amber-50/60 text-amber-900 print:hidden">
          <AlertTriangle className="size-4" />
          <AlertTitle>Roulement non configuré</AlertTitle>
          <AlertDescription>
            Le planning se calcule à partir du roulement (2 jours / 2 nuits / 2 repos). Configure-le dans{" "}
            <Link href="/parametres/roulement" className="font-medium underline">Régler le roulement</Link>{" "}
            pour afficher les postes. Les absences restent visibles en attendant.
          </AlertDescription>
        </Alert>
      )}

      {totalChauffeurs === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <Users className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">Aucun chauffeur</CardTitle>
            <CardDescription>Enregistre d&apos;abord des chauffeurs et rattache-les à une équipe.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div id="planning-print" className="space-y-4">
          {/* Titre visible uniquement à l'impression */}
          <div className="hidden print:block">
            <h2 className="text-lg font-bold capitalize">Planning — {monthLabel}</h2>
            <p className="text-xs">J = Jour (06h–18h) · N = Nuit (18h–06h) · R = Repos · Abs = Absent · Cgé = Congé</p>
          </div>

          {/* Légende (écran) */}
          <div className="flex flex-wrap items-center gap-2 text-xs print:hidden">
            {(["JOUR", "NUIT", "REPOS"] as RoulementPoste[]).map((p) => (
              <span key={p} className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1">
                <span className="flex size-4 items-center justify-center rounded text-[10px] font-bold" style={{ backgroundColor: POSTE_BG[p], color: POSTE_FG[p] }}>{ROULEMENT_POSTE_CODE[p]}</span>
                {ROULEMENT_POSTE_LABEL[p]}
              </span>
            ))}
            <span className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1">
              <span className="flex size-4 items-center justify-center rounded text-[10px] font-bold text-rose-900" style={{ backgroundColor: "#fecaca" }}>A</span>Absent
            </span>
            <span className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1">
              <span className="flex size-4 items-center justify-center rounded text-[10px] font-bold text-amber-900" style={{ backgroundColor: "#fde68a" }}>C</span>Congé
            </span>
          </div>

          {/* Une carte par équipe */}
          {equipes.map((eq) => {
            const drivers = chauffeursByEquipe.get(eq.id) ?? [];
            if (drivers.length === 0) return null;
            return (
              <Card key={eq.id} className="break-inside-avoid">
                <CardContent className="p-0">
                  <div className="flex items-center gap-2 border-b px-3 py-2">
                    <span className="flex size-5 items-center justify-center rounded text-[10px] font-bold text-white" style={{ backgroundColor: eq.couleur ?? "#3b82f6" }}>{eq.code}</span>
                    <span className="font-semibold">{eq.nom}</span>
                    <span className="text-xs text-muted-foreground">({drivers.length})</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[11px]">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="sticky left-0 z-10 bg-muted/40 px-2 py-1 text-left font-medium">Chauffeur</th>
                          {days.map((d) => {
                            const wd = d.getDay();
                            const weekend = wd === 0 || wd === 6;
                            const isToday = isoDate(d) === todayIso;
                            return (
                              <th key={d.getDate()} className={"px-0.5 py-1 text-center font-medium " + (isToday ? "bg-primary/10 text-primary " : weekend ? "bg-muted/60 " : "")}>
                                <div className="text-[9px] text-muted-foreground">{WEEKDAY_LETTER[wd]}</div>
                                <div>{d.getDate()}</div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {drivers.map((c) => (
                          <tr key={c.id} className="border-t">
                            <td className="sticky left-0 z-10 whitespace-nowrap bg-background px-2 py-1 font-medium">
                              {c.nom} {c.prenoms}
                            </td>
                            {days.map((d) => {
                              const ce = cell(c.id, eq.id, isoDate(d));
                              return (
                                <td key={d.getDate()} className="border-l p-px text-center">
                                  {ce ? (
                                    ce.kind === "POSTE" ? (
                                      <div className="flex h-6 items-center justify-center rounded-sm text-[10px] font-bold" title={ROULEMENT_POSTE_LABEL[ce.poste]} style={{ backgroundColor: POSTE_BG[ce.poste], color: POSTE_FG[ce.poste] }}>
                                        {ROULEMENT_POSTE_CODE[ce.poste]}
                                      </div>
                                    ) : (
                                      <div className="flex h-6 items-center justify-center rounded-sm text-[9px] font-bold" title={ce.label} style={{ backgroundColor: ce.code === "Cgé" ? "#fde68a" : "#fecaca", color: ce.code === "Cgé" ? "#78350f" : "#7f1d1d" }}>
                                        {ce.code}
                                      </div>
                                    )
                                  ) : (
                                    <div className="h-6" />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Chauffeurs sans équipe (hors roulement) */}
          {(chauffeursByEquipe.get(null)?.length ?? 0) > 0 && (
            <Card className="break-inside-avoid print:hidden">
              <CardContent className="p-3">
                <div className="mb-1 text-sm font-semibold text-muted-foreground">Hors roulement (sans équipe)</div>
                <p className="text-xs text-muted-foreground">
                  {chauffeursByEquipe.get(null)!.map((c) => `${c.nom} ${c.prenoms}`).join(", ")} — rattache-les à une équipe pour qu&apos;ils apparaissent dans le roulement.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Actions bas de page (hors impression) */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button asChild>
          <Link href={`/designations?date=${todayIso}`}><Megaphone className="mr-2 size-4" />Désignations du jour</Link>
        </Button>
        <Button asChild variant="outline" size="sm"><Link href="/equipes">Gérer les équipes</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href="/absences">Gérer les absences</Link></Button>
      </div>

      {/* Styles d'impression : ne garder que la grille, en paysage. */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 8mm; }
          body * { visibility: hidden !important; }
          #planning-print, #planning-print * { visibility: visible !important; }
          #planning-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
