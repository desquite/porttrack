import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import {
  ClipboardList,
  Plus,
  CheckCircle2,
  Package,
  User,
  Truck,
  Calendar,
} from "lucide-react";

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
import type { Database } from "@porttrack/shared";
import { AFFECTATION_STATUTS } from "@porttrack/shared";
import { AffectationsFilters } from "./_components/affectations-filters";

type AffectationStatut = Database["public"]["Enums"]["affectation_statut"];

const STATUT_VARIANT: Record<AffectationStatut, "secondary" | "info" | "success" | "danger"> = {
  PLANIFIEE: "secondary",
  EN_COURS:  "info",
  TERMINEE:  "success",
  ANNULEE:   "danger",
};

const STATUT_LABEL: Record<AffectationStatut, string> = {
  PLANIFIEE: "Planifiée",
  EN_COURS:  "En cours",
  TERMINEE:  "Terminée",
  ANNULEE:   "Annulée",
};

const PAGE_SIZE = 20;

export default async function AffectationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    created?: string;
    deleted?: string;
    statut?: string;
    page?: string;
  }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();

  const { count: totalGlobal } = await supabase
    .from("affectations")
    .select("*", { count: "exact", head: true });

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("affectations")
    .select(
      `*,
       conteneurs ( numero, client ),
       chauffeurs ( prenoms, nom ),
       tracteur:materiel_roulant!affectations_tracteur_id_fkey ( immatriculation )`,
      { count: "exact" },
    )
    .order("date_affectation", { ascending: false })
    .range(from, to);

  const statut = sp.statut?.trim();
  if (statut && (AFFECTATION_STATUTS as readonly string[]).includes(statut)) {
    query = query.eq("statut", statut as AffectationStatut);
  }

  const { data: affectations, count: filteredCount, error } = await query;

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
  const isFiltered = !!statut;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Flux & affectations</h1>
          <p className="text-sm text-muted-foreground">
            {isFiltered ? (
              <>
                <strong className="text-foreground">{total}</strong> résultat{total > 1 ? "s" : ""} sur{" "}
                {totalGlobal ?? 0} affectation{(totalGlobal ?? 0) > 1 ? "s" : ""}
              </>
            ) : (
              <>
                <strong className="text-foreground">{totalGlobal ?? 0}</strong> affectation
                {(totalGlobal ?? 0) > 1 ? "s" : ""} enregistrée
                {(totalGlobal ?? 0) > 1 ? "s" : ""}
              </>
            )}
          </p>
        </div>
        <Button asChild>
          <Link href="/affectations/new">
            <Plus className="mr-2 size-4" />
            Nouvelle affectation
          </Link>
        </Button>
      </div>

      {sp.created && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Affectation créée</AlertTitle>
          <AlertDescription>L'affectation a été ajoutée au planning.</AlertDescription>
        </Alert>
      )}
      {sp.deleted && (
        <Alert className="border-rose-200 bg-rose-50/60 text-rose-900">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Affectation supprimée</AlertTitle>
          <AlertDescription>L'affectation a été retirée du planning.</AlertDescription>
        </Alert>
      )}

      <AffectationsFilters />

      {total === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <ClipboardList className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">
              {isFiltered ? "Aucun résultat" : "Aucune affectation"}
            </CardTitle>
            <CardDescription>
              {isFiltered
                ? "Aucune affectation ne correspond à ce filtre."
                : "Crée une affectation pour lier un conteneur à un chauffeur et un véhicule."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(affectations as any[]).map((a) => (
              <AffectationCard key={a.id} affectation={a} />
            ))}
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            pathname="/affectations"
            itemLabel="affectation"
            className="rounded-md border bg-background"
          />
        </>
      )}
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function AffectationCard({ affectation: a }: { affectation: any }) {
  const conteneur = a.conteneurs;
  const chauffeur = a.chauffeurs;
  const tracteur = a.tracteur;

  return (
    <Card className="transition-colors hover:border-primary/30">
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <ClipboardList className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {conteneur ? (
              <span className="flex items-center gap-1 font-mono text-sm font-semibold">
                <Package className="size-3.5 text-muted-foreground" />
                {conteneur.numero}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Conteneur supprimé</span>
            )}
            <Badge variant={STATUT_VARIANT[a.statut as AffectationStatut]} className="text-[10px]">
              {STATUT_LABEL[a.statut as AffectationStatut]}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {chauffeur && (
              <span className="flex items-center gap-1">
                <User className="size-3" />
                {chauffeur.prenoms} {chauffeur.nom}
              </span>
            )}
            {tracteur && (
              <span className="flex items-center gap-1">
                <Truck className="size-3" />
                {tracteur.immatriculation}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              {formatDateFR(a.date_affectation)}
            </span>
            {conteneur?.client && <span>Client : {conteneur.client}</span>}
          </div>
        </div>

        <div className="ml-auto">
          <Button asChild variant="outline" size="sm">
            <Link href={`/affectations/${a.id}`}>Modifier</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
