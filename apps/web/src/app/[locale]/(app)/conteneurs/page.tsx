import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { Package, Plus, CheckCircle2, Ship, MapPin, Calendar } from "lucide-react";

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
import { CONTENEUR_STATUTS, normalizeForSearch } from "@porttrack/shared";
import { ConteneursFilters } from "./_components/conteneurs-filters";

type ConteneurStatut = Database["public"]["Enums"]["conteneur_statut"];

const STATUT_VARIANT: Record<ConteneurStatut, "secondary" | "info" | "success" | "danger"> = {
  EN_ATTENTE: "secondary",
  EN_COURS:   "info",
  LIVRE:      "success",
  ANNULE:     "danger",
};

const STATUT_LABEL: Record<ConteneurStatut, string> = {
  EN_ATTENTE: "En attente",
  EN_COURS:   "En cours",
  LIVRE:      "Livré",
  ANNULE:     "Annulé",
};

const PAGE_SIZE = 20;

export default async function ConteneursPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    created?: string;
    deleted?: string;
    q?: string;
    statut?: string;
    page?: string;
  }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();

  const { count: totalGlobal } = await supabase
    .from("conteneurs")
    .select("*", { count: "exact", head: true });

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Jointures vers les catalogues pour afficher les libellés
  let query = supabase
    .from("conteneurs")
    .select(
      `*,
       shipping_lines ( nom_court ),
       types_conteneur ( code_trade ),
       destination:port_codes!conteneurs_destination_id_fkey ( nom_lieu, pays_iso )`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  const q = sp.q?.trim();
  if (q) {
    const qNorm = normalizeForSearch(q).replace(/[%_]/g, "");
    if (qNorm) query = query.ilike("search_text", `%${qNorm}%`);
  }

  const statut = sp.statut?.trim();
  if (statut && (CONTENEUR_STATUTS as readonly string[]).includes(statut)) {
    query = query.eq("statut", statut as ConteneurStatut);
  }

  const { data: conteneurs, count: filteredCount, error } = await query;

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
          <h1 className="text-2xl font-bold tracking-tight">Conteneurs</h1>
          <p className="text-sm text-muted-foreground">
            {isFiltered ? (
              <>
                <strong className="text-foreground">{total}</strong> résultat{total > 1 ? "s" : ""} sur{" "}
                {totalGlobal ?? 0} conteneur{(totalGlobal ?? 0) > 1 ? "s" : ""} au total
              </>
            ) : (
              <>
                <strong className="text-foreground">{totalGlobal ?? 0}</strong> conteneur
                {(totalGlobal ?? 0) > 1 ? "s" : ""} suivi{(totalGlobal ?? 0) > 1 ? "s" : ""}
              </>
            )}
          </p>
        </div>
        <Button asChild>
          <Link href="/conteneurs/new">
            <Plus className="mr-2 size-4" />
            Nouveau conteneur
          </Link>
        </Button>
      </div>

      {sp.created && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Conteneur créé</AlertTitle>
          <AlertDescription>
            <strong className="font-mono">{sp.created}</strong> a été ajouté au suivi.
          </AlertDescription>
        </Alert>
      )}
      {sp.deleted && (
        <Alert className="border-rose-200 bg-rose-50/60 text-rose-900">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Conteneur supprimé</AlertTitle>
          <AlertDescription>
            <strong className="font-mono">{sp.deleted}</strong> a été retiré du suivi.
          </AlertDescription>
        </Alert>
      )}

      <ConteneursFilters />

      {total === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <Package className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">
              {isFiltered ? "Aucun résultat" : "Aucun conteneur"}
            </CardTitle>
            <CardDescription>
              {isFiltered
                ? "Aucun conteneur ne correspond à tes filtres."
                : "Commence par enregistrer un conteneur à suivre."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(conteneurs as any[]).map((c) => (
              <ConteneurCard key={c.id} conteneur={c} />
            ))}
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            pathname="/conteneurs"
            itemLabel="conteneur"
            className="rounded-md border bg-background"
          />
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function ConteneurCard({ conteneur: c }: { conteneur: any }) {
  const shippingLabel = c.shipping_lines?.nom_court as string | undefined;
  const typeLabel = c.types_conteneur?.code_trade as string | undefined;
  const destLabel = c.destination
    ? `${c.destination.nom_lieu} (${c.destination.pays_iso})`
    : (c.destination_libre as string | null);

  return (
    <Card className="transition-colors hover:border-primary/30">
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Package className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-base font-semibold">{c.numero}</span>
            {typeLabel && (
              <Badge variant="outline" className="text-[10px]">{typeLabel}</Badge>
            )}
            <Badge variant={STATUT_VARIANT[c.statut as ConteneurStatut]} className="text-[10px]">
              {STATUT_LABEL[c.statut as ConteneurStatut]}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {shippingLabel && (
              <span className="flex items-center gap-1">
                <Ship className="size-3" />
                {shippingLabel}
              </span>
            )}
            {c.client && <span>Client : {c.client}</span>}
            {destLabel && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" />
                {destLabel}
              </span>
            )}
            {c.date_badt && (
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                BADT : {formatDateFR(c.date_badt)}
              </span>
            )}
          </div>
        </div>

        <div className="ml-auto">
          <Button asChild variant="outline" size="sm">
            <Link href={`/conteneurs/${c.id}`}>Modifier</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
