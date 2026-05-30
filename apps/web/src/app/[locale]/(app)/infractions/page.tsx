import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { Gavel, Plus, CheckCircle2, User, Calendar, Banknote, AlertTriangle } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Pagination } from "@/components/ui/pagination";
import { formatDateFR } from "@/lib/utils/dates";
import { INFRACTION_STATUTS, type Database } from "@porttrack/shared";
import { InfractionsFilters } from "./_components/infractions-filters";

type InfractionStatut = Database["public"]["Enums"]["infraction_statut"];

const STATUT_VARIANT: Record<InfractionStatut, "danger" | "success" | "warning"> = {
  NON_PAYEE: "danger",
  PAYEE:     "success",
  CONTESTEE: "warning",
};
const STATUT_LABEL: Record<InfractionStatut, string> = {
  NON_PAYEE: "Non payée",
  PAYEE:     "Payée",
  CONTESTEE: "Contestée",
};

const PAGE_SIZE = 20;

export default async function InfractionsPage({
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
  const { count: totalGlobal } = await supabase.from("infractions").select("*", { count: "exact", head: true });

  // Total dû non payé (KPI dans le header)
  const { data: nonPayees } = await supabase.from("infractions").select("montant_fcfa").eq("statut", "NON_PAYEE");
  const totalDu = (nonPayees ?? []).reduce((acc, i) => acc + Number(i.montant_fcfa ?? 0), 0);

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("infractions")
    .select(
      `id, date_infraction, lieu_infraction, type_infraction, montant_fcfa, statut, imputation,
       chauffeur:chauffeurs ( nom, prenoms ),
       materiel:materiel_roulant ( immatriculation )`,
      { count: "exact" },
    )
    .order("date_infraction", { ascending: false })
    .range(from, to);

  const q = sp.q?.trim();
  if (q) {
    query = query.or([`type_infraction.ilike.%${q}%`, `lieu_infraction.ilike.%${q}%`, `description.ilike.%${q}%`].join(","));
  }
  const statut = sp.statut?.trim();
  if (statut && (INFRACTION_STATUTS as readonly string[]).includes(statut)) {
    query = query.eq("statut", statut as InfractionStatut);
  }
  const { data: infractions, count: filteredCount, error } = await query;
  if (error) return <Card><CardContent className="pt-6"><p className="text-sm text-rose-700">Erreur : {error.message}</p></CardContent></Card>;
  const total = filteredCount ?? 0;
  const isFiltered = !!(q || statut);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Infractions & amendes</h1>
          <p className="text-sm text-muted-foreground">
            {isFiltered ? <><strong className="text-foreground">{total}</strong> résultat{total > 1 ? "s" : ""} sur {totalGlobal ?? 0}</> :
              <><strong className="text-foreground">{totalGlobal ?? 0}</strong> infraction{(totalGlobal ?? 0) > 1 ? "s" : ""} — <strong className="text-rose-700">{totalDu.toLocaleString("fr-FR")} FCFA</strong> en attente</>}
          </p>
        </div>
        <Button asChild>
          <Link href="/infractions/new"><Plus className="mr-2 size-4" />Enregistrer une infraction</Link>
        </Button>
      </div>

      {sp.created && <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>Infraction enregistrée</AlertTitle></Alert>}
      {sp.deleted && <Alert className="border-rose-200 bg-rose-50/60 text-rose-900"><CheckCircle2 className="size-4" /><AlertTitle>Infraction supprimée</AlertTitle></Alert>}

      <InfractionsFilters />

      {total === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <Gavel className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">{isFiltered ? "Aucun résultat" : "Aucune infraction"}</CardTitle>
            <CardDescription>{isFiltered ? "Affine ou réinitialise les filtres." : "Tu peux enregistrer une infraction routière (PV, amende)."}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(infractions as any[]).map((i) => <InfractionCard key={i.id} infraction={i} />)}
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} pathname="/infractions" itemLabel="infraction" className="rounded-md border bg-background" />
        </>
      )}
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function InfractionCard({ infraction: i }: { infraction: any }) {
  const ch = i.chauffeur as { nom?: string; prenoms?: string } | null;
  const mr = i.materiel as { immatriculation?: string } | null;
  return (
    <Card className="transition-colors hover:border-primary/30">
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-800">
          <Gavel className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUT_VARIANT[i.statut as InfractionStatut]} className="text-[10px]">{STATUT_LABEL[i.statut as InfractionStatut]}</Badge>
            <Badge variant="outline" className="text-[10px]">{i.imputation === "CHAUFFEUR" ? "Charge chauffeur" : "Charge entreprise"}</Badge>
            <span className="font-medium truncate">{i.type_infraction}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {ch?.nom && <span className="flex items-center gap-1"><User className="size-3" />{ch.nom} {ch.prenoms ?? ""}</span>}
            {mr?.immatriculation && <span>{mr.immatriculation}</span>}
            {i.date_infraction && <span className="flex items-center gap-1"><Calendar className="size-3" />{formatDateFR(i.date_infraction)}</span>}
            <span className="flex items-center gap-1"><Banknote className="size-3" />{Number(i.montant_fcfa).toLocaleString("fr-FR")} FCFA</span>
            {i.statut === "NON_PAYEE" && i.date_limite_paiement && (
              <span className="flex items-center gap-1 text-rose-600"><AlertTriangle className="size-3" />Limite {formatDateFR(i.date_limite_paiement)}</span>
            )}
          </div>
        </div>
        <div className="ml-auto"><Button asChild variant="outline" size="sm"><Link href={`/infractions/${i.id}`}>Détails</Link></Button></div>
      </CardContent>
    </Card>
  );
}
