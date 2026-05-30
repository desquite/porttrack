import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { CalendarOff, Plus, CheckCircle2, User, Calendar } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { formatDateFR } from "@/lib/utils/dates";
import { ABSENCE_TYPES, type Database } from "@porttrack/shared";

type AbsenceType = Database["public"]["Enums"]["absence_type"];

const TYPE_LABEL: Record<AbsenceType, string> = {
  CONGE_PLANIFIE:   "Congé",
  ABSENCE_IMPREVUE: "Imprévue",
  MALADIE:          "Maladie",
  FORMATION:        "Formation",
  AUTRE:            "Autre",
};
const TYPE_VARIANT: Record<AbsenceType, "info" | "warning" | "danger" | "secondary"> = {
  CONGE_PLANIFIE:   "info",
  ABSENCE_IMPREVUE: "danger",
  MALADIE:          "warning",
  FORMATION:        "info",
  AUTRE:            "secondary",
};

export default async function AbsencesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ created?: string; deleted?: string; type?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();

  let query = supabase
    .from("absences")
    .select(`*, chauffeur:chauffeurs ( id, nom, prenoms )`)
    .order("date_debut", { ascending: false });

  const type = sp.type?.trim();
  if (type && (ABSENCE_TYPES as readonly string[]).includes(type)) {
    query = query.eq("type", type as AbsenceType);
  }

  const { data: absences } = await query;
  const today = new Date().toISOString().slice(0, 10);
  const enCours = (absences ?? []).filter((a) => a.date_debut <= today && a.date_fin >= today).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Absences & congés</h1>
          <p className="text-sm text-muted-foreground">
            {enCours > 0 ? <><strong className="text-rose-700">{enCours}</strong> chauffeur{enCours > 1 ? "s" : ""} absent{enCours > 1 ? "s" : ""} aujourd&apos;hui</> : "Aucun chauffeur absent aujourd'hui"}
          </p>
        </div>
        <Button asChild>
          <Link href="/absences/new"><Plus className="mr-2 size-4" />Enregistrer une absence</Link>
        </Button>
      </div>

      {sp.created && <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>Absence enregistrée</AlertTitle></Alert>}
      {sp.deleted && <Alert className="border-rose-200 bg-rose-50/60 text-rose-900"><CheckCircle2 className="size-4" /><AlertTitle>Absence supprimée</AlertTitle></Alert>}

      {/* Filtre par type */}
      <div className="flex flex-wrap gap-2">
        <Link href="/absences"
          className={"rounded-md border px-3 py-1.5 text-xs " + (!type ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-muted/40")}>
          Tous
        </Link>
        {ABSENCE_TYPES.map((t) => (
          <Link key={t} href={`/absences?type=${t}`}
            className={"rounded-md border px-3 py-1.5 text-xs " + (type === t ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-muted/40")}>
            {TYPE_LABEL[t]}
          </Link>
        ))}
      </div>

      {!absences || absences.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <CalendarOff className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">Aucune absence</CardTitle>
            <CardDescription>Tu peux enregistrer un congé, une maladie ou une absence imprévue.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(absences as any[]).map((a) => <AbsenceCard key={a.id} absence={a} today={today} />)}
        </div>
      )}
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function AbsenceCard({ absence: a, today }: { absence: any; today: string }) {
  const ch = a.chauffeur as { nom?: string; prenoms?: string; id?: string } | null;
  const enCours = a.date_debut <= today && a.date_fin >= today;
  const aVenir = a.date_debut > today;
  const passee = a.date_fin < today;
  const dureeJours = Math.max(1, Math.ceil((new Date(a.date_fin).getTime() - new Date(a.date_debut).getTime()) / 86400000) + 1);

  return (
    <Card className={"transition-colors hover:border-primary/30 " + (passee ? "opacity-70" : "")}>
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        <div className={"flex size-10 shrink-0 items-center justify-center rounded-md " + (enCours ? "bg-rose-100 text-rose-700" : "bg-muted text-muted-foreground")}>
          <CalendarOff className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={TYPE_VARIANT[a.type as AbsenceType]} className="text-[10px]">{TYPE_LABEL[a.type as AbsenceType]}</Badge>
            {enCours && <Badge variant="danger" className="text-[10px]">En cours</Badge>}
            {aVenir && <Badge variant="info" className="text-[10px]">À venir</Badge>}
            {ch?.nom && <span className="font-medium truncate">{ch.nom} {ch.prenoms ?? ""}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              {formatDateFR(a.date_debut)}{a.date_debut !== a.date_fin ? ` → ${formatDateFR(a.date_fin)}` : ""}
            </span>
            <span>{dureeJours} jour{dureeJours > 1 ? "s" : ""}</span>
            {a.motif && <span className="truncate">— {a.motif}</span>}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {ch?.id && <Button asChild variant="ghost" size="sm"><Link href={`/chauffeurs/${ch.id}`}><User className="size-3.5" /></Link></Button>}
          <Button asChild variant="outline" size="sm"><Link href={`/absences/${a.id}`}>Détails</Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}
