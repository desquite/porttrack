import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import {
  Gauge, Megaphone, ClipboardCheck, Package, Truck, PackageCheck, AlertTriangle,
  ChevronLeft, ChevronRight, RotateCcw, ArrowRight, CalendarClock, Wrench,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const FR_LONG = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

/**
 * Tableau de bord Opérations (cahier v8 §6.3) — navigable par date.
 *
 * Métriques ANCRÉES sur la date (exactes pour toute date) : chauffeurs désignés,
 * check-lists, livraisons confirmées du jour, BADT critiques.
 * Métriques d'ÉTAT LIVE (situation courante, faute d'historique d'état) :
 * conteneurs en attente, livraisons en cours.
 */
export default async function OperationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const today = isoDate(new Date());
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const dateLabel = FR_LONG.format(new Date(date + "T12:00:00"));
  const isToday = date === today;
  const isFuture = date > today;

  const supabase = await createClient();

  // Si la date est dans le futur : pas de données (cahier §6.3)
  if (isFuture) {
    return (
      <div className="space-y-6">
        <Header date={date} today={today} dateLabel={dateLabel} isToday={isToday} isFuture={isFuture} />
        <Alert className="border-amber-300 bg-amber-50/60 text-amber-900">
          <CalendarClock className="size-4" />
          <AlertTitle>Date future</AlertTitle>
          <AlertDescription>Aucune donnée pour une date à venir. Reviens à aujourd&apos;hui ou consulte une date passée.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const dateEnd = `${date}T23:59:59`;

  const [
    { count: designes },
    { data: checklistsDuJour },
    { count: enAttente },
    { count: enCours },
    { count: livreesDuJour },
    { count: badtCritiques },
  ] = await Promise.all([
    // 1. Chauffeurs désignés (VALIDÉS) du jour
    supabase.from("designations").select("*", { count: "exact", head: true })
      .eq("date_designation", date).not("validee_at", "is", null),
    // 2. Check-lists effectuées ce jour
    supabase.from("checklists_depart").select("statut_global").eq("date_depart", date),
    // 3. Conteneurs en attente (état live)
    supabase.from("conteneurs").select("*", { count: "exact", head: true }).eq("statut", "EN_ATTENTE"),
    // 4. Livraisons en cours (état live) — affectations parties, non confirmées
    supabase.from("affectations").select("*", { count: "exact", head: true }).eq("statut", "EN_COURS"),
    // 5. Livraisons confirmées ce jour
    supabase.from("conteneurs").select("*", { count: "exact", head: true })
      .eq("statut", "LIVRE").eq("date_livraison_reelle", date),
    // 6. BADT critiques : conteneurs ouverts dont le BADT est dépassé à cette date
    supabase.from("conteneurs").select("*", { count: "exact", head: true })
      .in("statut", ["EN_ATTENTE", "EN_COURS"]).not("date_badt", "is", null).lte("date_badt", dateEnd),
  ]);

  const checklistsFaites = (checklistsDuJour ?? []).length;

  // « À réaffecter » (état live) : conteneurs dont l'affectation active porte un
  // camion actuellement EN_PANNE → l'ops doit les remettre sur un autre camion.
  const { data: brokenTrucks } = await supabase
    .from("materiel_roulant")
    .select("id")
    .eq("etat", "EN_PANNE");
  const brokenIds = (brokenTrucks ?? []).map((t) => t.id);
  let aReaffecter = 0;
  if (brokenIds.length > 0) {
    const { count } = await supabase
      .from("affectations")
      .select("*", { count: "exact", head: true })
      .in("statut", ["PLANIFIEE", "EN_COURS"])
      .in("tracteur_id", brokenIds);
    aReaffecter = count ?? 0;
  }

  return (
    <div className="space-y-6">
      <Header date={date} today={today} dateLabel={dateLabel} isToday={isToday} isFuture={isFuture} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <OpsCard
          title="Chauffeurs désignés"
          value={designes ?? 0}
          subtitle="Désignations validées du jour"
          icon={<Megaphone className="size-4 text-primary" />}
          href={`/designations?date=${date}`}
        />
        <OpsCard
          title="Check-lists effectuées"
          value={`${checklistsFaites} / ${designes ?? 0}`}
          subtitle="Sur les chauffeurs désignés"
          icon={<ClipboardCheck className="size-4 text-emerald-600" />}
          href={`/checklists?date=${date}`}
        />
        <OpsCard
          title="BADT critiques"
          value={badtCritiques ?? 0}
          subtitle="Conteneurs ouverts à BADT dépassé"
          icon={<AlertTriangle className="size-4 text-amber-600" />}
          href="/conteneurs"
          highlight={(badtCritiques ?? 0) > 0}
        />
        <OpsCard
          title="Conteneurs en attente"
          value={enAttente ?? 0}
          subtitle="À affecter (état actuel)"
          icon={<Package className="size-4 text-primary" />}
          href="/affectations"
          live={!isToday}
        />
        <OpsCard
          title="Livraisons en cours"
          value={enCours ?? 0}
          subtitle="Partis, non confirmés (état actuel)"
          icon={<Truck className="size-4 text-primary" />}
          href="/affectations"
          live={!isToday}
        />
        <OpsCard
          title="Livraisons confirmées"
          value={livreesDuJour ?? 0}
          subtitle="EIR archivés ce jour"
          icon={<PackageCheck className="size-4 text-emerald-600" />}
          href="/eir"
        />
        <OpsCard
          title="À réaffecter"
          value={aReaffecter}
          subtitle="Conteneurs sur un camion en panne"
          icon={<Wrench className="size-4 text-rose-600" />}
          href="/affectations"
          highlight={aReaffecter > 0}
          live={!isToday}
        />
      </div>

      {!isToday && (
        <p className="text-xs text-muted-foreground">
          Vue du {dateLabel}. Les compteurs marqués « état actuel » reflètent la situation présente
          (l&apos;historique d&apos;état jour par jour n&apos;est pas conservé).
        </p>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------

function Header({
  date, today, dateLabel, isToday, isFuture,
}: { date: string; today: string; dateLabel: string; isToday: boolean; isFuture: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Gauge className="size-6 text-primary" />
          Tableau de bord Opérations
        </h1>
        <p className="flex items-center gap-2 text-sm text-muted-foreground capitalize">
          {dateLabel}
          {!isToday && !isFuture && <Badge variant="secondary" className="text-[10px] normal-case">Vue figée</Badge>}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/operations?date=${addDays(date, -1)}`}><ChevronLeft className="size-4" /></Link>
        </Button>
        <form action="/operations" className="flex items-center gap-2">
          <Input type="date" name="date" defaultValue={date} max={today} className="h-8 w-44" />
          <Button type="submit" size="sm" variant="outline">OK</Button>
        </form>
        <Button asChild variant="outline" size="sm">
          <Link href={`/operations?date=${today}`}><RotateCcw className="mr-1 size-3.5" />Aujourd&apos;hui</Link>
        </Button>
        <Button asChild variant="outline" size="sm" disabled={isToday}>
          <Link href={`/operations?date=${addDays(date, 1)}`}><ChevronRight className="size-4" /></Link>
        </Button>
      </div>
    </div>
  );
}

function OpsCard({
  title, value, subtitle, icon, href, highlight, live,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ReactNode;
  href: string;
  highlight?: boolean;
  live?: boolean;
}) {
  return (
    <Link href={href}>
      <Card className={"transition-colors hover:border-primary/40 hover:shadow-sm " + (highlight ? "border-amber-300 bg-amber-50/40" : "")}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-2xl font-bold">{value}</div>
              <p className="text-xs text-muted-foreground">
                {subtitle}
                {live && <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[9px] uppercase">actuel</span>}
              </p>
            </div>
            <ArrowRight className="size-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
