import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { CalendarRange, ChevronLeft, ChevronRight, RotateCcw, Plus, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  WEEKDAYS,
  PLANNING_CODE_ABSENCE,
  PLANNING_CODE_CONGE,
  type Database,
} from "@porttrack/shared";

type AbsenceType = Database["public"]["Enums"]["absence_type"];

/** Calcule le lundi de la semaine contenant la date donnée. */
function getMondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=dim, 1=lun..6=sam
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const FR_DATE_SHORT = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" });
const FR_MONTH_LONG = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

export default async function PlanningPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; equipe?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  // Semaine cible : lundi de la semaine contenant ?date= (ou aujourd'hui)
  const refDate = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)
    ? new Date(sp.date + "T12:00:00")
    : new Date();
  const monday = getMondayOf(refDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const startIso = isoDate(days[0]);
  const endIso   = isoDate(days[6]);
  const todayIso = isoDate(new Date());

  // Navigation semaine précédente / suivante / aujourd'hui
  const prevHref = `/planning?date=${isoDate(addDays(monday, -7))}${sp.equipe ? `&equipe=${sp.equipe}` : ""}`;
  const nextHref = `/planning?date=${isoDate(addDays(monday,  7))}${sp.equipe ? `&equipe=${sp.equipe}` : ""}`;
  const todayHref = `/planning${sp.equipe ? `?equipe=${sp.equipe}` : ""}`;

  const supabase = await createClient();

  // Charge les chauffeurs (filtrés sur équipe si demandé)
  let qChauffeurs = supabase
    .from("chauffeurs")
    .select("id, nom, prenoms, equipe_id_defaut, equipe:equipes ( id, nom, code, couleur, jours_travailles, actif )")
    .order("nom", { ascending: true });
  if (sp.equipe) qChauffeurs = qChauffeurs.eq("equipe_id_defaut", sp.equipe);

  const [{ data: chauffeurs }, { data: absences }, { data: equipes }] = await Promise.all([
    qChauffeurs,
    supabase
      .from("absences")
      .select("id, chauffeur_id, type, date_debut, date_fin")
      .lte("date_debut", endIso)
      .gte("date_fin", startIso),
    supabase
      .from("equipes")
      .select("id, nom, code, couleur, actif")
      .order("ordre", { ascending: true }),
  ]);

  // Indexe les absences par chauffeur_id (1 chauffeur peut avoir plusieurs absences)
  const absencesByChauffeur = new Map<string, { type: AbsenceType; date_debut: string; date_fin: string }[]>();
  for (const a of absences ?? []) {
    const arr = absencesByChauffeur.get(a.chauffeur_id) ?? [];
    arr.push(a);
    absencesByChauffeur.set(a.chauffeur_id, arr);
  }

  function cellForChauffeur(
    chauffeurId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    equipe: any,
    dateIso: string,
    weekday: number,
  ): { code: string; couleur: string; label: string } | null {
    // Absence prioritaire
    const abs = (absencesByChauffeur.get(chauffeurId) ?? []).find(
      (a) => a.date_debut <= dateIso && a.date_fin >= dateIso,
    );
    if (abs) {
      const isConge = abs.type === "CONGE_PLANIFIE";
      return {
        code: isConge ? PLANNING_CODE_CONGE : PLANNING_CODE_ABSENCE,
        couleur: isConge ? "#fde68a" : "#fecaca",
        label: isConge ? "Congé" : "Absent",
      };
    }
    // Équipe par défaut, si elle est active et travaille ce jour
    if (equipe && equipe.actif !== false) {
      const jours = (equipe.jours_travailles as number[] | null | undefined) ?? [];
      if (jours.includes(weekday)) {
        return { code: equipe.code, couleur: equipe.couleur ?? "#3b82f6", label: equipe.nom };
      }
    }
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <CalendarRange className="size-6 text-primary" />
            Planning hebdomadaire
          </h1>
          <p className="text-sm text-muted-foreground">
            {FR_DATE_SHORT.format(days[0])} → {FR_DATE_SHORT.format(days[6])} ({FR_MONTH_LONG.format(monday)})
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm"><Link href={prevHref}><ChevronLeft className="size-4" /></Link></Button>
          <Button asChild variant="outline" size="sm"><Link href={todayHref}><RotateCcw className="mr-1 size-3.5" />Aujourd&apos;hui</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href={nextHref}><ChevronRight className="size-4" /></Link></Button>
        </div>
      </div>

      {/* Légende équipes + filtre */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href={todayHref}
          className={"rounded-md border px-3 py-1.5 text-xs " + (!sp.equipe ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-muted/40")}>
          Toutes les équipes
        </Link>
        {(equipes ?? []).filter((e) => e.actif).map((e) => (
          <Link key={e.id} href={`/planning?equipe=${e.id}${sp.date ? `&date=${sp.date}` : ""}`}
            className={"flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs " + (sp.equipe === e.id ? "border-primary" : "border-input bg-background hover:bg-muted/40")}>
            <span className="flex size-4 items-center justify-center rounded text-[10px] font-bold text-white" style={{ backgroundColor: e.couleur ?? "#3b82f6" }}>
              {e.code}
            </span>
            {e.nom}
          </Link>
        ))}
        <span className="flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1 text-xs">
          <span className="flex size-4 items-center justify-center rounded text-[10px] font-bold text-rose-900" style={{ backgroundColor: "#fecaca" }}>A</span>
          Absent
        </span>
        <span className="flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1 text-xs">
          <span className="flex size-4 items-center justify-center rounded text-[10px] font-bold text-amber-900" style={{ backgroundColor: "#fde68a" }}>C</span>
          Congé
        </span>
      </div>

      {!chauffeurs || chauffeurs.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <Users className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">Aucun chauffeur</CardTitle>
            <CardDescription>
              {sp.equipe ? "Aucun chauffeur n'est rattaché à cette équipe." : "Tu dois d'abord enregistrer des chauffeurs."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left font-medium">Chauffeur</th>
                  {days.map((d, i) => {
                    const wkd = d.getDay();
                    const label = WEEKDAYS.find((w) => w.value === wkd)?.label ?? "";
                    const isToday = isoDate(d) === todayIso;
                    return (
                      <th key={i} className={"px-2 py-2 text-center font-medium " + (isToday ? "bg-primary/10 text-primary" : "")}>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
                        <div>{FR_DATE_SHORT.format(d)}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(chauffeurs as any[]).map((c) => {
                  const equipe = c.equipe;
                  return (
                    <tr key={c.id} className="border-t">
                      <td className="sticky left-0 z-10 bg-background px-3 py-2">
                        <Link href={`/chauffeurs/${c.id}`} className="block">
                          <div className="font-medium">{c.nom} {c.prenoms}</div>
                          {equipe ? (
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                              <span className="flex size-3 items-center justify-center rounded text-[8px] font-bold text-white" style={{ backgroundColor: equipe.couleur ?? "#3b82f6" }}>
                                {equipe.code}
                              </span>
                              {equipe.nom}
                            </div>
                          ) : (
                            <div className="mt-0.5 text-[10px] text-muted-foreground italic">Pas d&apos;équipe</div>
                          )}
                        </Link>
                      </td>
                      {days.map((d, i) => {
                        const wkd = d.getDay();
                        const cell = cellForChauffeur(c.id, equipe, isoDate(d), wkd);
                        return (
                          <td key={i} className="border-l p-1">
                            {cell ? (
                              <div
                                title={cell.label}
                                className="flex h-10 w-full items-center justify-center rounded text-sm font-bold text-white"
                                style={{ backgroundColor: cell.couleur, color: cell.code === "A" ? "#7f1d1d" : cell.code === "C" ? "#78350f" : "#fff" }}
                              >
                                {cell.code}
                              </div>
                            ) : (
                              <div className="h-10 w-full" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/equipes"><Plus className="mr-2 size-4" />Gérer les équipes</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/absences"><Plus className="mr-2 size-4" />Gérer les absences</Link>
        </Button>
        <Badge variant="secondary" className="text-[10px]">Vue lecture seule — édition cellule-par-cellule à venir (V3b)</Badge>
      </div>
    </div>
  );
}
