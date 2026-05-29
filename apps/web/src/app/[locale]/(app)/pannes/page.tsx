import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { Wrench, Plus, CheckCircle2, Truck, Calendar, Banknote } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Pagination } from "@/components/ui/pagination";
import { formatDateFR } from "@/lib/utils/dates";
import { PANNE_STATUTS, normalizeForSearch, type Database } from "@porttrack/shared";
import { PannesFilters } from "./_components/pannes-filters";

type PanneStatut = Database["public"]["Enums"]["panne_statut"];

const STATUT_VARIANT: Record<PanneStatut, "secondary" | "info" | "success" | "warning"> = {
  DECLAREE:      "warning",
  EN_REPARATION: "info",
  REPAREE:       "success",
  ANNULEE:       "secondary",
};

const STATUT_LABEL: Record<PanneStatut, string> = {
  DECLAREE:      "Déclarée",
  EN_REPARATION: "En réparation",
  REPAREE:       "Réparée",
  ANNULEE:       "Annulée",
};

const PAGE_SIZE = 20;

export default async function PannesPage({
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

  const { count: totalGlobal } = await supabase
    .from("pannes")
    .select("*", { count: "exact", head: true });

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("pannes")
    .select(
      `id, materiel_roulant_id, date_declaration, description, garage, type_panne,
       cout_estime_fcfa, cout_reel_fcfa, statut,
       materiel:materiel_roulant ( immatriculation, marque, modele )`,
      { count: "exact" },
    )
    .order("date_declaration", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  const q = sp.q?.trim();
  if (q) {
    const qNorm = normalizeForSearch(q).replace(/[%_]/g, "");
    if (qNorm) {
      query = query.or(
        [
          `description.ilike.%${qNorm}%`,
          `garage.ilike.%${qNorm}%`,
          `type_panne.ilike.%${qNorm}%`,
        ].join(","),
      );
    }
  }

  const statut = sp.statut?.trim();
  if (statut && (PANNE_STATUTS as readonly string[]).includes(statut)) {
    query = query.eq("statut", statut as PanneStatut);
  }

  const { data: pannes, count: filteredCount, error } = await query;

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-rose-700">Erreur de chargement : {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  const total = filteredCount ?? 0;
  const isFiltered = !!(q || statut);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pannes & réparations</h1>
          <p className="text-sm text-muted-foreground">
            {isFiltered ? (
              <>
                <strong className="text-foreground">{total}</strong> résultat{total > 1 ? "s" : ""} sur{" "}
                {totalGlobal ?? 0} panne{(totalGlobal ?? 0) > 1 ? "s" : ""} au total
              </>
            ) : (
              <>
                <strong className="text-foreground">{totalGlobal ?? 0}</strong> panne
                {(totalGlobal ?? 0) > 1 ? "s" : ""} enregistrée
                {(totalGlobal ?? 0) > 1 ? "s" : ""}
              </>
            )}
          </p>
        </div>
        <Button asChild>
          <Link href="/pannes/new">
            <Plus className="mr-2 size-4" />
            Déclarer une panne
          </Link>
        </Button>
      </div>

      {sp.created && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Panne déclarée</AlertTitle>
          <AlertDescription>Le matériel est marqué « En panne » automatiquement.</AlertDescription>
        </Alert>
      )}
      {sp.deleted && (
        <Alert className="border-rose-200 bg-rose-50/60 text-rose-900">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Panne supprimée</AlertTitle>
          <AlertDescription>L&apos;intervention a été retirée.</AlertDescription>
        </Alert>
      )}

      <PannesFilters />

      {total === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <Wrench className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">
              {isFiltered ? "Aucun résultat" : "Aucune panne"}
            </CardTitle>
            <CardDescription>
              {isFiltered
                ? "Aucune panne ne correspond à tes filtres."
                : "Tu peux déclarer une panne pour mettre un matériel en réparation."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(pannes as any[]).map((p) => (
              <PanneCard key={p.id} panne={p} />
            ))}
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            pathname="/pannes"
            itemLabel="panne"
            className="rounded-md border bg-background"
          />
        </>
      )}
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function PanneCard({ panne: p }: { panne: any }) {
  const mr = p.materiel as { immatriculation?: string; marque?: string; modele?: string } | null;
  const mrLabel = mr?.immatriculation
    ? `${mr.immatriculation}${mr.marque ? ` — ${mr.marque}${mr.modele ? ` ${mr.modele}` : ""}` : ""}`
    : "—";
  const cout = (p.cout_reel_fcfa ?? p.cout_estime_fcfa) as number | null;

  return (
    <Card className="transition-colors hover:border-primary/30">
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Wrench className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUT_VARIANT[p.statut as PanneStatut]} className="text-[10px]">
              {STATUT_LABEL[p.statut as PanneStatut]}
            </Badge>
            <span className="font-medium truncate">{p.description}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Truck className="size-3" />
              {mrLabel}
            </span>
            {p.date_declaration && (
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                {formatDateFR(p.date_declaration)}
              </span>
            )}
            {p.garage && <span>{p.garage}</span>}
            {cout != null && (
              <span className="flex items-center gap-1">
                <Banknote className="size-3" />
                {Number(cout).toLocaleString("fr-FR")} FCFA{p.cout_reel_fcfa == null ? " (estimé)" : ""}
              </span>
            )}
          </div>
        </div>

        <div className="ml-auto">
          <Button asChild variant="outline" size="sm">
            <Link href={`/pannes/${p.id}`}>Détails</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
