import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { ShieldAlert, Plus, CheckCircle2, Truck, MapPin, Calendar } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Pagination } from "@/components/ui/pagination";
import { formatDateFR } from "@/lib/utils/dates";
import { ACCIDENT_STATUTS, type Database } from "@porttrack/shared";
import { AccidentsFilters } from "./_components/accidents-filters";

type AccidentStatut = Database["public"]["Enums"]["accident_statut"];

const STATUT_VARIANT: Record<AccidentStatut, "secondary" | "info" | "success" | "danger" | "warning"> = {
  DECLARE:             "danger",
  EN_COURS_TRAITEMENT: "warning",
  CLOTURE:             "success",
};
const STATUT_LABEL: Record<AccidentStatut, string> = {
  DECLARE:             "Déclaré",
  EN_COURS_TRAITEMENT: "En cours",
  CLOTURE:             "Clôturé",
};

const PAGE_SIZE = 20;

export default async function AccidentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; statut?: string; page?: string; created?: string; deleted?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { count: totalGlobal } = await supabase.from("accidents").select("*", { count: "exact", head: true });

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("accidents")
    .select(
      `id, date_accident, lieu_accident, circonstances, statut, tiers_implique,
       materiel:materiel_roulant ( immatriculation, marque ),
       chauffeur:chauffeurs ( nom, prenoms )`,
      { count: "exact" },
    )
    .order("date_accident", { ascending: false })
    .range(from, to);

  const q = sp.q?.trim();
  if (q) {
    query = query.or(
      [`circonstances.ilike.%${q}%`, `lieu_accident.ilike.%${q}%`, `assurance_ref.ilike.%${q}%`].join(","),
    );
  }
  const statut = sp.statut?.trim();
  if (statut && (ACCIDENT_STATUTS as readonly string[]).includes(statut)) {
    query = query.eq("statut", statut as AccidentStatut);
  }

  const { data: accidents, count: filteredCount, error } = await query;
  if (error) {
    return (
      <Card><CardContent className="pt-6"><p className="text-sm text-rose-700">Erreur : {error.message}</p></CardContent></Card>
    );
  }

  const total = filteredCount ?? 0;
  const isFiltered = !!(q || statut);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accidents & sinistres</h1>
          <p className="text-sm text-muted-foreground">
            {isFiltered ? <><strong className="text-foreground">{total}</strong> résultat{total > 1 ? "s" : ""} sur {totalGlobal ?? 0}</> :
              <><strong className="text-foreground">{totalGlobal ?? 0}</strong> accident{(totalGlobal ?? 0) > 1 ? "s" : ""} enregistré{(totalGlobal ?? 0) > 1 ? "s" : ""}</>}
          </p>
        </div>
        <Button asChild>
          <Link href="/accidents/new"><Plus className="mr-2 size-4" />Déclarer un accident</Link>
        </Button>
      </div>

      {sp.created && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Accident déclaré</AlertTitle>
          <AlertDescription>Un Ordre de Réparation a été créé automatiquement et le matériel est marqué « Indisponible ».</AlertDescription>
        </Alert>
      )}
      {sp.deleted && (
        <Alert className="border-rose-200 bg-rose-50/60 text-rose-900">
          <CheckCircle2 className="size-4" /><AlertTitle>Accident supprimé</AlertTitle>
          <AlertDescription>Le dossier a été retiré.</AlertDescription>
        </Alert>
      )}

      <AccidentsFilters />

      {total === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <ShieldAlert className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">{isFiltered ? "Aucun résultat" : "Aucun accident"}</CardTitle>
            <CardDescription>{isFiltered ? "Affine ou réinitialise les filtres." : "Tu peux déclarer un accident — un OR sera créé automatiquement."}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(accidents as any[]).map((a) => <AccidentCard key={a.id} accident={a} />)}
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} pathname="/accidents" itemLabel="accident" className="rounded-md border bg-background" />
        </>
      )}
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function AccidentCard({ accident: a }: { accident: any }) {
  const mr = a.materiel as { immatriculation?: string; marque?: string } | null;
  const ch = a.chauffeur as { nom?: string; prenoms?: string } | null;
  return (
    <Card className="transition-colors hover:border-primary/30">
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-rose-100 text-rose-700">
          <ShieldAlert className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUT_VARIANT[a.statut as AccidentStatut]} className="text-[10px]">{STATUT_LABEL[a.statut as AccidentStatut]}</Badge>
            {a.tiers_implique && <Badge variant="warning" className="text-[10px]">Tiers impliqué</Badge>}
            <span className="font-medium truncate">{a.circonstances}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {mr?.immatriculation && <span className="flex items-center gap-1"><Truck className="size-3" />{mr.immatriculation}{mr.marque ? ` — ${mr.marque}` : ""}</span>}
            {ch?.nom && <span>{ch.nom} {ch.prenoms ?? ""}</span>}
            {a.date_accident && <span className="flex items-center gap-1"><Calendar className="size-3" />{formatDateFR(a.date_accident)}</span>}
            {a.lieu_accident && <span className="flex items-center gap-1"><MapPin className="size-3" />{a.lieu_accident}</span>}
          </div>
        </div>
        <div className="ml-auto"><Button asChild variant="outline" size="sm"><Link href={`/accidents/${a.id}`}>Détails</Link></Button></div>
      </CardContent>
    </Card>
  );
}
