import { Suspense } from "react";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import {
  Search, Package, FileText, Building2, CalendarClock, ChevronRight,
  CircleDot, Truck, PackageCheck, Undo2, Lock, XCircle,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PorttrackLoader } from "@/components/porttrack-loader";
import { cn } from "@/lib/utils";
import { formatDateFR } from "@/lib/utils/dates";
import { normalizeForSearch } from "@porttrack/shared";
import { RechercheBar } from "./_components/recherche-bar";
import { buildParcours, type ConteneurParcours, type TimelineStep } from "./_components/load-timeline";

const RESULT_LIMIT = 60;

const STEP_ICON: Record<TimelineStep["kind"], React.ComponentType<{ className?: string }>> = {
  cree: CircleDot,
  affecte: Truck,
  livre: PackageCheck,
  recup_planifiee: Undo2,
  recupere: Lock,
  annule: XCircle,
};

/**
 * Module « Recherche » (Opérations conteneurs).
 * Recherche par n° conteneur OU n° BL. Regroupe les résultats par BL, et pour
 * chaque conteneur affiche son parcours (timeline d'étapes réellement franchies).
 *
 * La barre reste visible en permanence ; seule la zone résultats est suspendue
 * (loader ancre PORTTRACK) pendant le chargement des données.
 */
export default async function RechercheConteneurPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const qRaw = sp.q?.trim() ?? "";

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Search className="size-6 text-primary" />
          Recherche
        </h1>
        <p className="text-sm text-muted-foreground">
          Retrouve un conteneur ou un BL et visualise son parcours complet.
        </p>
      </header>

      <RechercheBar defaultValue={qRaw} />

      {/* key={qRaw} → le fallback (loader) se ré-affiche à chaque nouvelle recherche */}
      <Suspense key={qRaw} fallback={<PorttrackLoader label="Recherche en cours…" />}>
        <SearchResults qRaw={qRaw} />
      </Suspense>
    </div>
  );
}

/** Zone résultats (async) — suspendue pendant le fetch. */
async function SearchResults({ qRaw }: { qRaw: string }) {
  const qNorm = qRaw ? normalizeForSearch(qRaw).replace(/[%_]/g, "").trim() : "";

  if (!qNorm) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
          <Search className="size-8 opacity-40" />
          Saisis un n° de conteneur ou de BL pour démarrer la recherche.
        </CardContent>
      </Card>
    );
  }

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("conteneurs")
    .select("id, numero, numero_bl, client, transitaire, date_badt, statut, created_at, date_livraison_reelle")
    .ilike("search_text", `%${qNorm}%`)
    .order("created_at", { ascending: false })
    .limit(RESULT_LIMIT);
  const parcours = await buildParcours(rows ?? []);

  if (parcours.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Aucun conteneur ne correspond à « {qRaw} ».
        </CardContent>
      </Card>
    );
  }

  // Regroupement par BL (les conteneurs sans BL → groupe « Sans BL »)
  const groups = new Map<string, ConteneurParcours[]>();
  for (const p of parcours) {
    const key = p.numeroBl?.trim() || "__SANS_BL__";
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }

  return (
    <div className="space-y-5">
      {Array.from(groups.entries()).map(([key, conteneurs]) => {
        const bl = key === "__SANS_BL__" ? null : key;
        const head = conteneurs[0];
        return (
          <div key={key} className="space-y-2">
            {/* En-tête BL */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <FileText className="size-4 text-primary" />
                {bl ? `BL ${bl}` : "Sans BL"}
              </span>
              <Badge variant="secondary" className="text-[10px]">
                {conteneurs.length} conteneur{conteneurs.length > 1 ? "s" : ""}
              </Badge>
              {head.client && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Building2 className="size-3.5" />{head.client}
                </span>
              )}
              {head.transitaire && (
                <span className="text-muted-foreground">Transitaire : {head.transitaire}</span>
              )}
              {head.dateBadt && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <CalendarClock className="size-3.5" />BADT {formatDateFR(head.dateBadt)}
                </span>
              )}
            </div>

            {/* Conteneurs du BL avec leur parcours */}
            <div className="space-y-2">
              {conteneurs.map((c) => (
                <ConteneurCard key={c.id} c={c} />
              ))}
            </div>
          </div>
        );
      })}
      {parcours.length === RESULT_LIMIT && (
        <p className="text-center text-xs text-muted-foreground">
          {RESULT_LIMIT} premiers résultats affichés. Affine ta recherche.
        </p>
      )}
    </div>
  );
}

function ConteneurCard({ c }: { c: ConteneurParcours }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <Link href={`/conteneurs/${c.id}`} className="inline-flex items-center gap-2 font-mono font-semibold hover:underline">
            <Package className="size-4 text-muted-foreground" />
            {c.numero}
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="info" className="text-[10px]">{c.etatLabel}</Badge>
            <Link href={`/conteneurs/${c.id}`} className="text-muted-foreground hover:text-foreground">
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>

        {/* Timeline verticale du parcours */}
        <ol className="space-y-0">
          {c.steps.map((s, i) => {
            const Icon = STEP_ICON[s.kind];
            const last = i === c.steps.length - 1;
            return (
              <li key={i} className="flex gap-3">
                {/* Rail + pastille */}
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full",
                      s.kind === "annule" ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-700",
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  {!last && <span className="w-px flex-1 bg-border" />}
                </div>
                {/* Contenu */}
                <div className={cn("min-w-0 pb-3", last && "pb-0")}>
                  <div className="flex flex-wrap items-center gap-x-2 text-sm">
                    <span className="font-medium">{s.label}</span>
                    {s.date && <span className="text-xs text-muted-foreground">· {formatDateFR(s.date)}</span>}
                  </div>
                  {s.detail && <p className="text-xs text-muted-foreground">{s.detail}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
