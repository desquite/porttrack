import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import {
  ClipboardCheck, CheckCircle2, ChevronLeft, ChevronRight, RotateCcw,
  Truck, AlertTriangle, MinusCircle, Plus, User,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

const FR_LONG = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

type StatutGlobal = "FAITE" | "REMARQUE" | "NON_FAITE";
const STATUT_LABEL: Record<StatutGlobal, string> = {
  FAITE: "Faite",
  REMARQUE: "Remarque",
  NON_FAITE: "Non faite",
};
const STATUT_VARIANT: Record<StatutGlobal, "success" | "warning" | "secondary"> = {
  FAITE: "success",
  REMARQUE: "warning",
  NON_FAITE: "secondary",
};
const STATUT_ICON: Record<StatutGlobal, typeof CheckCircle2> = {
  FAITE: CheckCircle2,
  REMARQUE: AlertTriangle,
  NON_FAITE: MinusCircle,
};

export default async function ChecklistsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; created?: string; updated?: string; deleted?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const today = isoDate(new Date());
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const dateLabel = FR_LONG.format(new Date(date + "T12:00:00"));

  const supabase = await createClient();

  // Toutes les désignations du jour + leur check-list éventuelle
  const { data: designations } = await supabase
    .from("designations")
    .select(`
      id, date_designation,
      chauffeur:chauffeurs ( id, nom, prenoms ),
      materiel:materiel_roulant ( id, immatriculation, chrono ),
      equipe:equipes ( nom, code, couleur ),
      checklist:checklists_depart!checklists_depart_designation_id_fkey (
        id, statut_global, heure_validation, remarque
      )
    `)
    .eq("date_designation", date)
    // Seules les désignations VALIDÉES génèrent une check-list attendue
    // (les brouillons ne sont pas encore officiels — cahier v8 §6.2).
    .not("validee_at", "is", null)
    .order("created_at", { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (designations ?? []) as any[];

  // « Faites » = toutes les check-lists effectuées (avec OU sans anomalie).
  // « Avec remarque » est un sous-ensemble (mis en avant), pas une catégorie
  // exclusive. « Non faites » = désignations sans check-list.
  const counts = rows.reduce(
    (acc, r) => {
      const cl = Array.isArray(r.checklist) ? r.checklist[0] : r.checklist;
      if (!cl) {
        acc.NON_FAITE += 1;
      } else {
        acc.FAITE += 1;
        if (cl.statut_global === "REMARQUE") acc.REMARQUE += 1;
      }
      return acc;
    },
    { FAITE: 0, REMARQUE: 0, NON_FAITE: 0 } as Record<StatutGlobal, number>,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ClipboardCheck className="size-6 text-primary" />
            Check-lists de départ
          </h1>
          <p className="text-sm text-muted-foreground capitalize">{dateLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/checklists?date=${addDays(date, -1)}`}><ChevronLeft className="size-4" /></Link>
          </Button>
          <form action="/checklists" className="flex items-center gap-2">
            <Input type="date" name="date" defaultValue={date} className="h-8 w-44" />
            <Button type="submit" size="sm" variant="outline">OK</Button>
          </form>
          <Button asChild variant="outline" size="sm">
            <Link href={`/checklists?date=${today}`}><RotateCcw className="mr-1 size-3.5" />Aujourd&apos;hui</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/checklists?date=${addDays(date, 1)}`}><ChevronRight className="size-4" /></Link>
          </Button>
        </div>
      </div>

      {sp.created && <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>Check-list enregistrée</AlertTitle></Alert>}
      {sp.updated && <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>Check-list mise à jour</AlertTitle></Alert>}
      {sp.deleted && <Alert className="border-rose-200 bg-rose-50/60 text-rose-900"><CheckCircle2 className="size-4" /><AlertTitle>Check-list supprimée</AlertTitle></Alert>}

      {/* KPI bar du jour */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Faites" value={counts.FAITE} variant="success" icon={CheckCircle2} />
        <KpiCard label="Avec remarque" value={counts.REMARQUE} variant="warning" icon={AlertTriangle} />
        <KpiCard label="Non faites" value={counts.NON_FAITE} variant="secondary" icon={MinusCircle} />
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <ClipboardCheck className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">Aucune désignation</CardTitle>
            <CardDescription>
              Il n&apos;y a pas de désignation pour cette date — donc pas de check-list à effectuer.
              <Link href={`/designations?date=${date}`} className="ml-1 text-primary hover:underline">
                Aller aux désignations →
              </Link>
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((d) => <ChecklistRow key={d.id} d={d} />)}
        </div>
      )}
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function ChecklistRow({ d }: { d: any }) {
  const ch = d.chauffeur as { id: string; nom: string; prenoms: string } | null;
  const mr = d.materiel as { id: string; immatriculation: string; chrono: string | null } | null;
  const equipe = d.equipe as { nom: string; code: string; couleur: string | null } | null;
  const cl = (Array.isArray(d.checklist) ? d.checklist[0] : d.checklist) as
    | { id: string; statut_global: "FAITE" | "REMARQUE"; heure_validation: string; remarque: string | null }
    | null;

  const statut: StatutGlobal = cl ? cl.statut_global : "NON_FAITE";
  const StatIcon = STATUT_ICON[statut];
  const heure = cl ? new Date(cl.heure_validation).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";

  const mrLabel = mr ? (mr.chrono ? `${mr.chrono} (${mr.immatriculation})` : mr.immatriculation) : "—";

  return (
    <Card className="transition-colors hover:border-primary/30">
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <ClipboardCheck className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {equipe && (
              <span className="flex size-5 items-center justify-center rounded text-[10px] font-bold text-white" style={{ backgroundColor: equipe.couleur ?? "#3b82f6" }}>
                {equipe.code}
              </span>
            )}
            <span className="font-medium truncate">{ch?.nom ?? "?"} {ch?.prenoms ?? ""}</span>
            <span className="text-xs text-muted-foreground">→</span>
            <span className="flex items-center gap-1 text-sm">
              <Truck className="size-3.5 text-muted-foreground" />
              {mrLabel}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <Badge variant={STATUT_VARIANT[statut]} className="gap-1 text-[10px]">
              <StatIcon className="size-3" />
              {STATUT_LABEL[statut]}
            </Badge>
            <span>Heure : {heure}</span>
            {cl?.remarque && <span className="truncate italic">— {cl.remarque}</span>}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {ch && <Button asChild variant="ghost" size="sm"><Link href={`/chauffeurs/${ch.id}`}><User className="size-3.5" /></Link></Button>}
          {cl ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/checklists/${cl.id}`}>Détails</Link>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link href={`/checklists/new?designation=${d.id}`}><Plus className="mr-1 size-3.5" />Saisir</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function KpiCard({
  label, value, variant, icon: Icon,
}: {
  label: string;
  value: number;
  variant: "success" | "warning" | "secondary";
  icon: typeof CheckCircle2;
}) {
  const cls = variant === "success"
    ? "border-emerald-300 bg-emerald-50/40 text-emerald-900"
    : variant === "warning"
    ? "border-amber-300 bg-amber-50/40 text-amber-900"
    : "border-muted bg-muted/30 text-muted-foreground";
  return (
    <Card className={cls}>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className="size-5" />
        <div>
          <div className="text-2xl font-bold leading-tight">{value}</div>
          <div className="text-xs">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
